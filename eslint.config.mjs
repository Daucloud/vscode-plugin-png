import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const configDirectory = dirname(fileURLToPath(import.meta.url));

export default [
    {
        ignores: ["dist/**", ".test-dist/**", ".vscode-test/**", "node_modules/**"],
    },
    {
        files: ["**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: configDirectory,
            },
            ecmaVersion: 2022,
            sourceType: "module",
        },
        rules: {
            ...typescriptEslint.configs.recommended.rules,
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/no-unnecessary-condition": "error",
            "@typescript-eslint/switch-exhaustiveness-check": "error",
            curly: ["error", "all"],
            eqeqeq: ["error", "always"],
            "no-throw-literal": "error",
            semi: ["error", "always"],
        },
    },
];
