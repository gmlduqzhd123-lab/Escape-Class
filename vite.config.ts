import { defineConfig } from "vite";
// Relative output works at an unknown repository path. Pages CI supplies its actual base_path.
export default defineConfig({
  base: process.env.PAGES_BASE || "./",
  build: { target: "es2022" },
});
