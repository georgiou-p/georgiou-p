import { Link } from 'react-router-dom';
import { experiences, education } from '../data/experience';
import Seo from './Seo';
import { getSeoForPath } from '../data/seo';

const TYPE_COLORS = {
  research: '#00eaff',
  industry: '#a855f7',
  military: '#fc8c05',
};

function TimelineItem({ exp, index, isLast }) {
  const color = TYPE_COLORS[exp.type] || '#00eaff';
  return (
    <article className="tl-item" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="tl-spine">
        <div className="tl-dot" style={{ background: color }} />
        {!isLast && <div className="tl-line" />}
      </div>
      <div className="tl-card">
        <div className="tl-top">
          <span className="tl-type" style={{ color }}>{exp.type}</span>
          <span className="tl-period">{exp.period}</span>
        </div>
        <h3 className="tl-role">{exp.role}</h3>
        <p className="tl-org">{exp.org} · {exp.location}</p>
        <ul className="tl-bullets">
          {exp.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <div className="tl-tags">
          {exp.tags.map(t => <span key={t} className="pcard-tag">{t}</span>)}
        </div>
      </div>
    </article>
  );
}

export default function ExperiencePage() {
  return (
    <>
      <Seo {...getSeoForPath('/experience')} />
      <main className="page">
        <Link to="/" className="page-back-link">← back</Link>
        <div className="page-header">
          <p className="page-label">experience</p>
          <h1 className="page-title">Where I've Been</h1>
          <p className="page-subtitle">just what I want to show you</p>
        </div>

        <section className="exp-section">
          <h2 className="exp-label">work & research</h2>
          <div className="timeline">
            {experiences.map((exp, i) => (
              <TimelineItem key={exp.id} exp={exp} index={i} isLast={i === experiences.length - 1} />
            ))}
          </div>
        </section>

        <section className="exp-section">
          <h2 className="exp-label">education</h2>
          <div className="timeline">
            {education.map((exp, i) => (
              <TimelineItem key={exp.id} exp={exp} index={i} isLast={i === education.length - 1} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
