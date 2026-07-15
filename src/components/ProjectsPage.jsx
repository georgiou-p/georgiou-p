import { Link } from 'react-router-dom';
import { projects } from '../data/projects';
import Seo from './Seo';
import JsonLd from './JsonLd';
import { getSeoForPath } from '../data/seo';

const PROJECTS_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: projects.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'CreativeWork',
      name: p.name,
      description: p.desc,
      ...(p.github ? { url: p.github } : {}),
    },
  })),
};

function ProjectCard({ project, index }) {
  const inner = (
    <>
      <div className="pcard-num">{String(index + 1).padStart(2, '0')}</div>
      <h2 className="pcard-name">{project.name}</h2>
      <p className="pcard-desc">{project.desc}</p>
      <div className="pcard-tags">
        {project.tags.map(t => <span key={t} className="pcard-tag">{t}</span>)}
      </div>
    </>
  );

  if (!project.github) {
    return <div className="pcard" style={{ animationDelay: `${index * 40}ms` }}>{inner}</div>;
  }

  return (
    <a
      href={project.github}
      target="_blank"
      rel="noopener noreferrer"
      className="pcard"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {inner}
    </a>
  );
}

export default function ProjectsPage() {
  return (
    <>
      <Seo {...getSeoForPath('/projects')} />
      <JsonLd data={PROJECTS_JSON_LD} />
      <main className="page">
        <Link to="/" className="page-back-link">← back</Link>
        <div className="page-header">
          <p className="page-label">projects</p>
          <h1 className="page-title">What I've Built</h1>
          <p className="page-subtitle">just some of them</p>
        </div>
        <div className="projects-grid">
          {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
        </div>
      </main>
    </>
  );
}
