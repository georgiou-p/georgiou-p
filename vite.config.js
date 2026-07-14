import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served under /georgiou-p/ on the default GitHub Pages URL until the
// georgiou.pro custom domain is purchased and public/CNAME is restored —
// switch this back to '/' at that point (root-path serving).
export default defineConfig({
  base: '/georgiou-p/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@react-three')) return 'react-three';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'react-vendor';
        },
      },
    },
  },
})
