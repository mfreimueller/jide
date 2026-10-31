import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  main: {
    // Fixed at build time (release.yml passes the production URL); dev default is the local backend.
    define: { __JIDE_API_URL__: JSON.stringify(process.env["JIDE_API_URL"] || "http://localhost:3000") }
  },
  preload: {},
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      rollupOptions: { input: resolve(__dirname, "src/renderer/index.html") }
    },
    plugins: [svelte()]
  }
});
