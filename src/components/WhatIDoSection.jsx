import { Link } from 'react-router-dom';

const CARDS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
        <path d="M12 3 1 8l11 5 9-4.09V15h2V8L12 3z" />
        <path d="M5 10.18v4.34c0 1.5 3.13 3.48 7 3.48s7-1.98 7-3.48v-4.34" />
      </svg>
    ),
    title: 'PhD in AI for Sustainability',
    org: 'University of Southampton - SustAI CDT',
    body: 'Researching sustainable AI systems, multi-agent modelling, and their applications for real-world challenges.',
    linkText: 'Learn more',
    to: '/experience',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
        <path d="M12 2 3 6v6c0 5 3.8 9.4 9 10 5.2-.6 9-5 9-10V6l-9-4z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    title: 'AI Governance',
    org: 'Co-founder, AI³ — AI Integrity Institute',
    body: 'Working with researchers, companies, and governments to put responsible AI into practice, so it benefits all societies.',
    linkText: 'Visit AI³',
    to: 'https://ai-3.org',
    external: true,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
        <path d="M12 2 3 6v6c0 5 3.8 9.4 9 10 5.2-.6 9-5 9-10V6l-9-4z" />
      </svg>
    ),
    title: 'Reserve Second-Lieutenant',
    org: 'Cypriot National Guard',
    body: 'Leadership, discipline, and resilience from military service, applied to technology and research.',
    linkText: 'More about me',
    to: '/experience',
  },
];

function WhatIDoCard({ card }) {
  const linkArrow = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );

  return (
    <div className="whatido-card">
      <div className="whatido-icon">{card.icon}</div>
      <div className="whatido-card-body">
        <h3 className="whatido-title">{card.title}</h3>
        <p className="whatido-org">{card.org}</p>
        <p className="whatido-body">{card.body}</p>
        {card.external ? (
          <a href={card.to} target="_blank" rel="noopener noreferrer" className="whatido-link">
            {card.linkText}
            {linkArrow}
          </a>
        ) : (
          <Link to={card.to} className="whatido-link">
            {card.linkText}
            {linkArrow}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function WhatIDoSection() {
  return (
    <div className="whatido-section">
      <h2 className="whatido-heading">What I Do</h2>
      <p className="page-subtitle">some of it</p>
      <div className="whatido-grid">
        {CARDS.map((card) => (
          <WhatIDoCard key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
