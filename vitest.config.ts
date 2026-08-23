import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    coverage: {
      reporter: ["text", "json-summary"],
    },
    include: ["packages/**/*.test.ts", "apps/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
