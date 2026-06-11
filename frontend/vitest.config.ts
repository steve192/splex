import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["default", ["junit", { outputFile: "test-results/junit.xml" }]],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "cobertura"],
      // Logic modules only. Mirror sonar.coverage.exclusions: .tsx components
      // have no test harness, and styles/theme/assets/generated carry no logic.
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.generated.ts",
        "src/shared/ui/styles.ts",
        "src/shared/ui/colors.ts",
        "src/application/theme.ts",
        "src/shared/assets/images.ts"
      ],
      reportsDirectory: "coverage"
    }
  }
});
