import { useState, useRef, useEffect } from 'react';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
const CV_URL = `${import.meta.env.BASE_URL}Prokopis_Georgiou_CV.pdf`;

const STARTERS = [
  'What is he currently working on?',
  'What are his top skills?',
  'Tell me about his research',
  'Is he open to new opportunities?',
];

function TypingDots() {
  return (
    <div className="chat-typing">
      <span /><span /><span />
    </div>
  );
}

function DownloadButton() {
  return (
    <a
      href={CV_URL}
      download="Prokopis_Georgiou_CV.pdf"
      className="cv-download-btn"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M12 16l-5-5 1.4-1.4 2.6 2.6V4h2v8.2l2.6-2.6L17 11l-5 5zm-7 4v-2h14v2H5z" />
      </svg>
      Download CV
    </a>
  );
}

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;

function renderWithLinks(text) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link">{part}</a>
      : part
  );
}

function Message({ role, text }) {
  const hasCV = role === 'assistant' && text.includes('[DOWNLOAD_CV]');
  const cleanText = text.replace('[DOWNLOAD_CV]', '').trim();

  return (
    <div className={`chat-message ${role}`}>
      {role === 'assistant' && <div className="chat-avatar">P</div>}
      <div className="chat-bubble-wrapper">
        {cleanText && (
          <div className="chat-bubble">
            {role === 'assistant' ? renderWithLinks(cleanText) : cleanText}
          </div>
        )}
        {hasCV && <DownloadButton />}
      </div>
    </div>
  );
}

export default function ChatPanel({ onFirstMessage, expanded, onToggle, onFocusExpand }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const firstMessage = useRef(false);
  const dragStartY = useRef(null);
  const dragFromHeader = useRef(false);

  function handleHeaderTouchStart(e) {
    dragStartY.current = e.touches[0].clientY;
    dragFromHeader.current = true;
  }

  function handleHeaderTouchEnd(e) {
    if (dragStartY.current === null) return;
    const delta = dragStartY.current - e.changedTouches[0].clientY;
    if (delta > 40 && !expanded) onToggle?.();   // swipe up on header → expand
    else if (delta < -40 && expanded) onToggle?.(); // swipe down on header → collapse
    dragStartY.current = null;
    dragFromHeader.current = false;
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    setError('');
    if (!firstMessage.current) {
      firstMessage.current = true;
      onFirstMessage?.();
    }

    const userMsg = { role: 'user', parts: [{ text: text.trim() }] };
    const newHistory = [...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), userMsg];

    setMessages(prev => [...prev, { role: 'user', text: text.trim() }]);
    setInput('');
    setLoading(true);

    try {
      if (!WORKER_URL) {
        throw new Error('VITE_WORKER_URL is not set. Please configure the Cloudflare Worker URL in your .env file.');
      }

      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) throw new Error('No response from AI.');

      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const showStarters = messages.length === 0 && !loading;

  return (
    <div className="chat-panel">
      <div
        className="chat-header"
        onClick={onToggle}
        onTouchStart={handleHeaderTouchStart}
        onTouchEnd={handleHeaderTouchEnd}
        style={{ cursor: onToggle ? 'pointer' : 'default' }}
      >
        <div className="chat-mobile-handle" />
        <div className="chat-header-dot" />
        <div className="chat-header-text">
          <span className="chat-header-title">AI Assistant</span>
          <span className="chat-header-sub">Ask me anything about him</span>
        </div>
      </div>

      <div className="chat-messages">
        {showStarters && (
          <div className="chat-starters">
            <p className="chat-starters-label">Try asking:</p>
            {STARTERS.map((s) => (
              <button
                key={s}
                className="chat-starter-chip"
                onClick={() => sendMessage(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <Message key={`${m.role}-${i}`} role={m.role} text={m.text} />
        ))}

        {loading && (
          <div className="chat-message assistant">
            <div className="chat-avatar">P</div>
            <TypingDots />
          </div>
        )}

        {error && (
          <div className="chat-error">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Ask me anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => onFocusExpand?.()}
          rows={1}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={() => { onFocusExpand?.(); sendMessage(input); }}
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
