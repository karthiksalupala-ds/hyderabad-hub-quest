import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [tanstackStart({ server: { entry: "server" } }), react(), tailwindcss(), tsconfigPaths()],
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router"] },
});
