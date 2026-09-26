import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        environment: "node",
        coverage: {
            provider: "v8",
            include: ["src/**"],
            exclude: ["src/__tests__/**", "src/index.ts"],
            thresholds: {
                "src/domain/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
                "src/application/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
            },
        },
    },
})
