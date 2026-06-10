import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["default", ["junit", { outputFile: "test-results/junit.xml" }]],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "cobertura"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reportsDirectory: "coverage"
    }
  }
});
