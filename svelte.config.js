import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// For GitHub *project* pages the site is served from /<repo>/, so set
// BASE_PATH=/<repo> at build time. Empty for user/org root pages or a custom
// domain. The deploy workflow sets this automatically.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // 404.html is what GitHub Pages serves for unknown paths (SPA fallback).
    adapter: adapter({ fallback: '404.html' }),
    paths: { base },
    alias: { $lib: 'src/lib' }
  }
};

export default config;
