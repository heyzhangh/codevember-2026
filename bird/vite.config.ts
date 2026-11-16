import { defineConfig } from 'vite';

// Relative URLs also work when these static files live below a site's root.
export default defineConfig({ base: './', build: { target: 'es2022' } });
