import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Single-page app: every unknown path is answered with index.html (see static/.htaccess).
			adapter: adapter({ fallback: 'index.html' })
		})
	],
	server: {
		port: 5174,
		// In development the API is on :3000; proxying keeps requests same-origin.
		proxy: { '/api': 'http://localhost:3000' }
	}
});
