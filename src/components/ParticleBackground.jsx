import { useEffect, useRef } from 'react';

const COLS = 32;
const ROWS = 20;
const INFLUENCE = 160;
const DOT_R = 0.9;
const DOT_R_HOT = 2.0;

const BLOB_DEFS = [
  { x: 0.15, y: 0.20, r: 0.48, rgb: '0,60,120',  sp: 1.10, ph: 0.0 },
  { x: 0.78, y: 0.18, r: 0.42, rgb: '0,90,150',  sp: 0.80, ph: 1.2 },
  { x: 0.82, y: 0.78, r: 0.50, rgb: '50,0,110',  sp: 1.40, ph: 2.4 },
  { x: 0.22, y: 0.82, r: 0.44, rgb: '0,40,90',   sp: 0.70, ph: 3.6 },
  { x: 0.52, y: 0.48, r: 0.36, rgb: '0,80,140',  sp: 1.60, ph: 0.8 },
];

export default function ParticleBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf, W, H, pts;
    // Vignette is static — cached and rebuilt only on resize
    let vignette = null;

    function buildGrid() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const gapX = W / (COLS + 1);
      const gapY = H / (ROWS + 1);
      pts = [];
      for (let r = 1; r <= ROWS; r++)
        for (let c = 1; c <= COLS; c++)
          pts.push({ ox: gapX * c, oy: gapY * r, vx: 0, vy: 0, x: gapX * c, y: gapY * r });
      vignette = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.72);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const ts = performance.now() * 0.0003;

      // Background + animated blobs
      ctx.fillStyle = '#050a14';
      ctx.fillRect(0, 0, W, H);

      for (const b of BLOB_DEFS) {
        const cx = (b.x + Math.sin(ts * b.sp * 1.3) * 0.08) * W;
        const cy = (b.y + Math.cos(ts * b.sp * 0.9) * 0.07) * H;
        const rad = b.r * Math.max(W, H);
        // Radial gradient must be created per-frame because centre moves
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0,   `rgba(${b.rgb},0.22)`);
        g.addColorStop(0.5, `rgba(${b.rgb},0.07)`);
        g.addColorStop(1,   `rgba(${b.rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Static vignette (cached)
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      // ── dots ──
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const hot = [];
      const cellW = W / COLS;

      for (const p of pts) {
        const dx = mx - p.ox, dy = my - p.oy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const t = Math.max(0, 1 - dist / INFLUENCE);

        const targetX = p.ox + (t > 0 ? dx * t * 18 / Math.max(dist, 1) : 0);
        const targetY = p.oy + (t > 0 ? dy * t * 18 / Math.max(dist, 1) : 0);
        p.vx = (p.vx + (targetX - p.x) * 0.18) * 0.72;
        p.vy = (p.vy + (targetY - p.y) * 0.18) * 0.72;
        p.x += p.vx;
        p.y += p.vy;

        const r = DOT_R + t * (DOT_R_HOT - DOT_R);
        const alpha = 0.06 + t * 0.45;

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,234,255,${alpha})`;
        ctx.fill();

        if (t > 0.12) hot.push({ p, t });
      }

      // ── glow pass (batched separately to avoid per-dot state flush) ──
      ctx.shadowColor = '#00eaff';
      for (const { p, t } of hot) {
        if (t <= 0.55) continue;
        ctx.shadowBlur = 6 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, DOT_R + t * (DOT_R_HOT - DOT_R), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,234,255,${0.06 + t * 0.45})`;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // ── connecting lines ──
      for (let i = 0; i < hot.length; i++) {
        for (let j = i + 1; j < hot.length; j++) {
          const a = hot[i].p, b = hot[j].p;
          const lx = a.x - b.x, ly = a.y - b.y;
          if (Math.sqrt(lx*lx + ly*ly) > cellW * 1.8) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(0,234,255,${hot[i].t * hot[j].t * 0.18})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    }

    buildGrid();
    draw();

    const onMove    = e => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave   = () => { mouseRef.current = { x: -9999, y: -9999 }; };
    const onResize  = () => buildGrid(); // named so cleanup can remove it
    const onTouch   = e => { const t = e.touches[0]; if (t) mouseRef.current = { x: t.clientX, y: t.clientY }; };
    const onTouchEnd = () => { mouseRef.current = { x: -9999, y: -9999 }; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
