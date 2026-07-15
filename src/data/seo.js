export const SITE_URL = 'https://georgiou.pro';
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const SEO_DEFAULTS = {
  siteName: 'Prokopis Georgiou',
  ogImage: OG_IMAGE,
  twitterCard: 'summary_large_image',
};

export const ROUTE_SEO = {
  '/': {
    title: 'Prokopis Georgiou — AI Researcher & PhD Candidate',
    description: 'Prokopis Georgiou is an AI researcher and PhD candidate at the University of Southampton (SustAI CDT), focused on sustainable AI, multi-agent systems, and responsible AI for real-world impact.',
    path: '/',
    type: 'website',
  },
  '/projects': {
    title: 'Projects — Prokopis Georgiou',
    description: 'A selection of AI, systems, and software engineering projects by Prokopis Georgiou, including offline reinforcement learning research, multi-agent simulation, and distributed systems.',
    path: '/projects',
    type: 'website',
  },
  '/experience': {
    title: 'Experience — Prokopis Georgiou',
    description: 'Research, industry, and education background of Prokopis Georgiou: PhD in AI for Sustainability, research internships, and software/security industry experience.',
    path: '/experience',
    type: 'website',
  },
};

export function getSeoForPath(pathname) {
  return ROUTE_SEO[pathname] || {
    title: 'Page Not Found — Prokopis Georgiou',
    description: 'The page you are looking for does not exist.',
    path: pathname,
    type: 'website',
    noindex: true,
  };
}
