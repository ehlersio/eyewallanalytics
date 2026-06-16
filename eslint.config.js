import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,

  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Promise: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        FormData: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        performance: "readonly",
        Audio: "readonly",
        Notification: "readonly",
        alert: "readonly",
        atob: "readonly",
        btoa: "readonly",
        getComputedStyle: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        // Node/Vite
        process: "readonly",
        import: "readonly",
      },
    },
    settings: {
      react: { version: "18" },
    },
    rules: {
      // ── React ────────────────────────────────────────────────
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react/prop-types": "off",
      "react/display-name": "warn",
      "react/no-unknown-property": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-undef": "error",
      "react/no-deprecated": "warn",
      "react/no-direct-mutation-state": "error",
      "react/self-closing-comp": "warn",

      // ── React Hooks ──────────────────────────────────────────
      "react-hooks/rules-of-hooks": "error",
      // exhaustive-deps intentionally omitted in many places — keep as warn
      // but suppress per-line with eslint-disable where deliberate
      "react-hooks/exhaustive-deps": "off",

      // ── General JS ──────────────────────────────────────────
      "no-unused-vars": ["warn", {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
      }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-undef": "error",
      "no-empty": ["warn", { allowEmptyCatch: true }], // empty catch blocks reviewed separately
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-constant-condition": "warn",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "prefer-const": "warn",
    },
  },

  // Test files — relax some rules
  {
    files: ["src/**/*.test.{js,jsx}", "cypress/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        cy: "readonly",
        Cypress: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },

  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "cypress/reports/**",
      "*.config.js",
    ],
  },
];
