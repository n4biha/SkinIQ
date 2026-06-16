import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Map the "@/..." import alias to the repo root so tests resolve modules exactly
// like the app does. These are plain Node unit tests (no DOM needed).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
