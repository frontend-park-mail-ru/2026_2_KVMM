import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", "dist/", ".design/", "packages/*/dist/"] },
  js.configs.recommended,
  {
    rules: {
      curly: "error",
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["server/**/*.js", "webpack.config.js", "postcss.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  {
    files: ["src/**/*.ts", "packages/*/src/**/*.ts"],
    extends: [tseslint.configs.recommended],
    ...jsdoc.configs["flat/recommended-typescript-error"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      ...jsdoc.configs["flat/recommended-typescript-error"].rules,
      "no-console": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            ClassDeclaration: true,
            FunctionDeclaration: true,
            MethodDefinition: true,
          },
          checkConstructors: true,
          checkGetters: false,
        },
      ],
    },
  },
  {
    files: ["src/sw/**/*.ts"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
);
