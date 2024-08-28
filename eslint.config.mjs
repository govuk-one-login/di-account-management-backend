import globals from "globals";
import pluginJs from "@eslint/js";
import tsEslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import tsEslintParser from "@typescript-eslint/parser";

export default [
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {languageOptions: { globals: globals.node, parser: tsEslintParser }},
  pluginJs.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    ignores: [".aws-sam/"]
  },
  {
    "rules": {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "vars": "all",
          "args": "after-used",
          "ignoreRestSiblings": true,
          "caughtErrors": "none"
        }
      ]
    }
  },
  {
    "files": ["**/*.test.ts", "**/*.spec.ts"],
    "rules": {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  eslintConfigPrettier,
];
