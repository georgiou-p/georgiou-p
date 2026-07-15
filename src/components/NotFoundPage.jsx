import { Link, useLocation } from 'react-router-dom';
import Seo from './Seo';
import { getSeoForPath } from '../data/seo';

export default function NotFoundPage() {
  const location = useLocation();
  return (
    <>
      <Seo {...getSeoForPath(location.pathname)} />
      <main className="page notfound-page">
        <p className="page-label">404</p>
        <h1 className="page-title">Page Not Found</h1>
        <p className="page-subtitle">This page doesn&apos;t exist &mdash; or it wandered off.</p>
        <Link to="/" className="notfound-home-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
      </main>
    </>
  );
}
