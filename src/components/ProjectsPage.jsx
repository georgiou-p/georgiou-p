import { Link } from 'react-router-dom';
import { projects } from '../data/projects';

function ProjectCard({ project, index }) {
  const inner = (
    <>
      <div className="pcard-num">{String(index + 1).padStart(2, '0')}</div>
      <h3 className="pcard-name">{project.name}</h3>
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
    <div className="page">
      <Link to="/" className="page-back-link">← back</Link>
      <div className="page-header">
        <p className="page-label">projects</p>
        <h1 className="page-title">What I've Built</h1>
        <p className="page-subtitle">just some of them</p>
      </div>
      <div className="projects-grid">
        {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
      </div>
    </div>
  );
}
