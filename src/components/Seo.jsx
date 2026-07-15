import { SEO_DEFAULTS, SITE_URL } from '../data/seo';

// React 19 hoists <title>/<meta>/<link> rendered anywhere in the tree up
// into <head>, deduplicating by attribute — no react-helmet needed.
export default function Seo({ title, description, path, type = 'website', noindex = false }) {
  const url = `${SITE_URL}${path}`;

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SEO_DEFAULTS.siteName} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={SEO_DEFAULTS.ogImage} />
      <meta property="og:image:width" content="1731" />
      <meta property="og:image:height" content="909" />

      <meta name="twitter:card" content={SEO_DEFAULTS.twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={SEO_DEFAULTS.ogImage} />
    </>
  );
}
