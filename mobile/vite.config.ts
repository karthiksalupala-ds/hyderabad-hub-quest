import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  base: "./",
  build: {
    outDir: fileURLToPath(new URL("./www", import.meta.url)),
    emptyOutDir: true,
  },
});
