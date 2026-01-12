import eslint from "@eslint/js"
import tseslint from "@typescript-eslint/eslint-plugin"
import tsparser from "@typescript-eslint/parser"
import importPlugin from "eslint-plugin-import"

export default [
    eslint.configs.recommended,
    {
        files: ["packages/**/*.ts", "packages/**/*.tsx"],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: ["./packages/*/tsconfig.json"],
            },
        },
        plugins: {
            "@typescript-eslint": tseslint,
            import: importPlugin,
        },
        rules: {
            // TypeScript strict rules
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],

            // Code quality
            "prefer-const": "error",
            eqeqeq: ["error", "always"],
            curly: ["error", "all"],
            "no-console": ["error", { allow: ["warn", "error"] }],

            // Complexity limits
            "max-params": ["error", { max: 5 }],
            "max-lines-per-function": ["error", { max: 100 }],
            complexity: ["error", { max: 15 }],
            "max-depth": ["error", { max: 4 }],

            // Import ordering
            "import/order": [
                "error",
                {
                    groups: [
                        "builtin",
                        "external",
                        "internal",
                        "parent",
                        "sibling",
                        "index",
                        "type",
                    ],
                    "newlines-between": "always",
                    alphabetize: { order: "asc" },
                },
            ],

            // Disable base rules that conflict with TypeScript
            "no-unused-vars": "off",
            "no-undef": "off",
        },
    },
    {
        ignores: [
            "**/dist/**",
            "**/node_modules/**",
            "**/*.js",
            "**/vite.config.ts",
            "**/vitest.config.ts",
            "**/tailwind.config.ts",
            "**/postcss.config.js",
            "**/__tests__/**",
            "**/*.test.ts",
        ],
    },
]
