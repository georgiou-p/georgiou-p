/**
 * Cloudflare Worker — Groq proxy + Resend notifications
 *
 * Secrets needed:
 *   wrangler secret put GROQ_API_KEY
 *   wrangler secret put RESEND_API_KEY
 */

import { SYSTEM_PROMPT } from './context.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const NOTIFY_EMAIL = 'prokopisgeorgiou16@gmail.com';
const FROM_EMAIL = 'onboarding@resend.dev';

// Per-IP rate limiting: max 10 requests per minute, max 30 per hour
const RATE_LIMIT_WINDOW_MIN  = 60 * 1000;       // 1 minute
const RATE_LIMIT_WINDOW_HOUR = 60 * 60 * 1000;  // 1 hour
const MAX_PER_MIN  = 10;
const MAX_PER_HOUR = 30;
// Max characters in a single message to block prompt-stuffing
const MAX_MESSAGE_CHARS = 1000;

// In-memory store — resets when worker instance restarts (fine for rate limiting)
const ipStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  if (!ipStore.has(ip)) {
    ipStore.set(ip, { requests: [], blocked: false });
  }
  const record = ipStore.get(ip);

  // Purge old entries beyond 1 hour
  record.requests = record.requests.filter(t => now - t < RATE_LIMIT_WINDOW_HOUR);

  const perMin  = record.requests.filter(t => now - t < RATE_LIMIT_WINDOW_MIN).length;
  const perHour = record.requests.length;

  if (perMin >= MAX_PER_MIN)  return { blocked: true, reason: 'Too many requests. Please wait a moment.' };
  if (perHour >= MAX_PER_HOUR) return { blocked: true, reason: 'Hourly limit reached. Come back later.' };

  record.requests.push(now);
  return { blocked: false };
}

const IMPORTANT_KEYWORDS = [
  'hire', 'hiring', 'job', 'role', 'position', 'internship', 'intern',
  'opportunity', 'recruit', 'offer', 'salary', 'interview', 'contract',
  'cv', 'resume', 'contact', 'email', 'reach out', 'connect',
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
const OWNER_CODE_REGEX = /PG69\s*([\s\S]*)/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isImportant(messages) {
  const allText = messages
    .map(m => {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.parts)) return m.parts.map(p => p.text ?? '').join(' ');
      if (m.parts?.[0]?.text) return m.parts[0].text;
      return '';
    })
    .join(' ')
    .toLowerCase();
  return IMPORTANT_KEYWORDS.some(kw => allText.includes(kw));
}

async function sendOwnerNote(note, resendKey) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: '📝 Note to self from portfolio',
      html: `
        <h2>📝 Note from Prokopis</h2>
        <p>${note.replace(/\n/g, '<br/>')}</p>
        <hr/>
        <p style="color:#888;font-size:12px;">Triggered via owner command on portfolio.</p>
      `,
    }),
  });
  const resBody = await res.json();
  console.log('Owner note Resend response:', res.status, JSON.stringify(resBody));
}

async function sendNotification(messages, resendKey) {
  const conversation = messages
    .map(m => {
      const role = m.role === 'user' ? 'Visitor' : 'Prokopis AI';
      const text = m.parts?.[0]?.text ?? m.content ?? '';
      return `<b>${role}:</b> ${text}`;
    })
    .join('<br/><br/>');

  const html = `
    <h2>📬 New conversation on your portfolio</h2>
    <p>Someone had a notable conversation on <b>prokopisgeorgiou.com</b>.</p>
    <hr/>
    <h3>Full conversation:</h3>
    <p>${conversation}</p>
    <hr/>
    <p style="color:#888;font-size:12px;">Sent automatically from your portfolio AI assistant.</p>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: '📬 Important conversation on your portfolio',
      html,
    }),
  });
  const resBody = await res.json();
  console.log('Resend response:', res.status, JSON.stringify(resBody));
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Per-IP rate limiting
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const rateCheck = checkRateLimit(ip);
    if (rateCheck.blocked) {
      return json({ error: rateCheck.reason }, 429);
    }

    const url = new URL(request.url);

    // Dedicated endpoint: receive full conversation and email it
    if (url.pathname === '/notify') {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false }, 400); }
      const { messages } = body;
      if (Array.isArray(messages) && messages.length > 0 && isImportant(messages) && env.RESEND_API_KEY) {
        ctx.waitUntil(
          sendNotification(messages, env.RESEND_API_KEY).catch(e => console.error('Resend error:', e))
        );
      }
      return json({ ok: true });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { messages } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages array is required' }, 400);
    }

    // Block oversized messages (prompt stuffing)
    const latestMsg = [...messages].reverse().find(m => m.role === 'user');
    const latestText = latestMsg?.parts?.[0]?.text ?? latestMsg?.content ?? '';
    if (latestText.length > MAX_MESSAGE_CHARS) {
      return json({ error: 'Message too long.' }, 400);
    }

    // Intercept owner command before hitting the model
    const ownerMatch = latestText.match(OWNER_CODE_REGEX);
    if (ownerMatch && env.RESEND_API_KEY) {
      const note = ownerMatch[1].trim() || '(no message)';
      ctx.waitUntil(
        sendOwnerNote(note, env.RESEND_API_KEY)
          .catch(e => console.error('Owner note error:', e))
      );
      return json({ candidates: [{ content: { parts: [{ text: 'Got it.' }] } }] });
    }

    const recentMessages = messages.slice(-5);
    const openaiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recentMessages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.parts?.[0]?.text ?? m.content ?? '',
      })),
    ];

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return json({ error: data?.error?.message || 'Groq API error' }, groqRes.status);
    }

    const text = data.choices?.[0]?.message?.content ?? '';

    const latestUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const latestUserText = latestUserMessage?.parts?.[0]?.text ?? latestUserMessage?.content ?? '';

    // Send notification if the latest user message contains an email address
    if (EMAIL_REGEX.test(latestUserText) && env.RESEND_API_KEY) {
      ctx.waitUntil(
        sendNotification([...messages, { role: 'assistant', parts: [{ text }] }], env.RESEND_API_KEY)
          .catch(e => console.error('Resend error:', e))
      );
    }

    return json({
      candidates: [{ content: { parts: [{ text }] } }],
    });
  },
};
