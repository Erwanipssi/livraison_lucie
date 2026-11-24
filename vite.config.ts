import { defineConfig } from 'vite';

// `base: './'` rend tous les chemins relatifs : le build fonctionne aussi bien
// sur https://username.github.io/<nom-du-repo>/ que sur n'importe quel hébergement statique.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
        },
      },
    },
  },
  server: { host: true },
});
