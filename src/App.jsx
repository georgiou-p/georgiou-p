import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import IntroPanel from './components/IntroPanel';
import ChatPanel from './components/ChatPanel';
import ParticleBackground from './components/ParticleBackground';
import WhatIDoSection from './components/WhatIDoSection';
import './App.css';

// Heavy Three.js chunk — loaded lazily so it doesn't block initial paint
const HologramHead  = lazy(() => import('./components/HologramHead'));
const ProjectsPage  = lazy(() => import('./components/ProjectsPage'));
const ExperiencePage = lazy(() => import('./components/ExperiencePage'));
const NotFoundPage = lazy(() => import('./components/NotFoundPage'));

function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const navigate = useNavigate();
  const location = useLocation();

  function goToAssistant() {
    close();
    if (location.pathname === '/') {
      // Target the chat panel itself, not just the top of the whatido
      // section — on tablet/mobile the cards stack above the chat, so
      // scrolling to the section's top would land on the cards instead.
      document.querySelector('.chat-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // HomePage owns chatExpanded state (siblings under App, so no
      // shared props) — ask it to expand the chat on mobile via event
      // rather than lifting state up just for this one interaction.
      window.dispatchEvent(new Event('open-assistant'));
    } else {
      navigate('/', { state: { scrollToAssistant: true } });
    }
  }

  function goHome(e) {
    close();
    // Clicking the brand while already on "/" doesn't remount HomePage
    // (same route), so nothing would otherwise reset the scroll position
    // back to the hero — scroll it directly in that case. .home-scroll
    // is only the actual scroll container on desktop; on tablet/mobile
    // it's normal-flow content and the window/page scrolls instead, so
    // scrollTo() on the element itself would silently do nothing there.
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('.home-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" onClick={goHome}>Prokopis Georgiou</Link>

      {/* Desktop links */}
      <div className="navbar-links">
        <NavLink to="/projects" className={({ isActive }) => isActive ? 'nav-active' : ''}>Projects</NavLink>
        <NavLink to="/experience" className={({ isActive }) => isActive ? 'nav-active' : ''}>Experience</NavLink>
        <a href="https://github.com/georgiou-p" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.linkedin.com/in/prokopis-georgiou/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <button className="navbar-ai-btn" onClick={goToAssistant}>
          <span className="navbar-ai-dot" />
          AI Assistant
        </button>
      </div>

      {/* Hamburger button — mobile only */}
      <button
        className="navbar-hamburger"
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        <span className={`hamburger-line ${open ? 'open' : ''}`} />
        <span className={`hamburger-line ${open ? 'open' : ''}`} />
        <span className={`hamburger-line ${open ? 'open' : ''}`} />
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="navbar-mobile-menu">
          <NavLink to="/projects" onClick={close} className={({ isActive }) => isActive ? 'nav-active' : ''}>Projects</NavLink>
          <NavLink to="/experience" onClick={close} className={({ isActive }) => isActive ? 'nav-active' : ''}>Experience</NavLink>
          <a href="https://github.com/georgiou-p" target="_blank" rel="noopener noreferrer" onClick={close}>GitHub</a>
          <a href="https://www.linkedin.com/in/prokopis-georgiou/" target="_blank" rel="noopener noreferrer" onClick={close}>LinkedIn</a>
          <button className="navbar-ai-btn navbar-ai-btn--mobile" onClick={goToAssistant}>
            <span className="navbar-ai-dot" />
            AI Assistant
          </button>
        </div>
      )}
    </nav>
  );
}

function HomePage() {
  // chatExpanded = user explicitly opened chat via header tap/drag (hides left col on mobile)
  const [chatExpanded, setChatExpanded] = useState(false);
  const scrollRef = useRef(null);
  const heroRef = useRef(null);
  const whatIDoRef = useRef(null);
  const scrollProgress = useRef(0);
  const location = useLocation();

  const isMobile = () => window.innerWidth <= 768;

  useEffect(() => {
    // Fired by the navbar's AI Assistant button (both when already on
    // "/" and via the scrollToAssistant navigation below) — expand the
    // chat to full-screen on mobile instead of just scrolling to a
    // partially-visible strip. Registered before the effect below so
    // it's already listening if that effect dispatches on mount.
    function onOpenAssistant() {
      if (isMobile()) setChatExpanded(true);
    }
    window.addEventListener('open-assistant', onOpenAssistant);
    return () => window.removeEventListener('open-assistant', onOpenAssistant);
  }, []);

  useEffect(() => {
    if (location.state?.scrollToAssistant) {
      // Target the chat panel itself, not just the section's top — on
      // tablet/mobile the cards stack above the chat, so scrolling to
      // whatIDoRef would land on the cards instead.
      document.querySelector('.chat-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState({}, '');
      window.dispatchEvent(new Event('open-assistant'));
    } else {
      // Browsers restore each scrollable element's scroll offset on
      // reload, which can land mid-page on the scroll-snap sections —
      // always start the home page at the hero on a fresh load/navigation.
      // .home-scroll is only the real scroll container on desktop; on
      // tablet/mobile it's normal-flow content and the window scrolls.
      window.scrollTo({ top: 0 });
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [location.state]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Drives the head's scroll-turn (right-facing → left-facing) purely
    // via a ref, not state, so scrolling doesn't trigger React re-renders.
    // Reads the hero's own viewport position (how far its top has moved
    // above the navbar) rather than a container's scrollTop — that stays
    // correct whether .home-scroll itself is the scroll container
    // (desktop) or laid out in normal flow with the page/window
    // scrolling instead (mobile).
    function onScroll() {
      const heroHeight = heroRef.current?.offsetHeight || 1;
      const heroTop = heroRef.current?.getBoundingClientRect().top ?? 0;
      const navbarHeight = 56;
      const scrolled = navbarHeight - heroTop;
      scrollProgress.current = Math.min(1, Math.max(0, scrolled / heroHeight));
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <main className="home-scroll" ref={scrollRef}>
      <section className="snap-section hero-section" ref={heroRef}>
        <div className="hero-visual-col">
          <Suspense fallback={null}>
            <HologramHead scrollProgress={scrollProgress} />
          </Suspense>
        </div>
        <div className="hero-text-col">
          <IntroPanel />
        </div>
      </section>

      <section className="snap-section whatido-page" ref={whatIDoRef}>
        <div className="whatido-col">
          <WhatIDoSection />
        </div>
        <div className={`chat-col ${chatExpanded ? 'chat-open' : ''}`}>
          <ChatPanel
            onFirstMessage={() => {}}
            onFocusExpand={() => {}}
            expanded={chatExpanded}
            onToggle={() => { if (isMobile()) setChatExpanded(o => !o); }}
          />
        </div>
      </section>
    </main>
  );
}

function HeroDecor() {
  return (
    <div className="hero-decor" aria-hidden="true">
      <div className="hd-grid" />
      <div className="hd-corner hd-corner--tl" />
      <div className="hd-corner hd-corner--tr" />
      <div className="hd-corner hd-corner--bl" />
      <div className="hd-corner hd-corner--br" />
      <div className="hd-hline hd-hline--top" />
      <div className="hd-hline hd-hline--bot" />
      <div className="hd-vline hd-vline--left" />
      <div className="hd-vline hd-vline--right" />
      <div className="hd-watermark">PG</div>
      <div className="hd-ring hd-ring--1" />
      <div className="hd-ring hd-ring--2" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="app">
        <ParticleBackground />
        <HeroDecor />
        <Navbar />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/experience" element={<ExperiencePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
