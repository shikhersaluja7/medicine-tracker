// vitest.config.ts — Configuration for the Vitest test runner.
//
// What is Vitest?
// Vitest is a test runner for TypeScript/JavaScript. It runs your test files
// and reports which tests pass or fail. It's similar to Jest but faster
// and works better with modern TypeScript.
//
// Why "environment: node"?
// Our tests run in Node.js (your computer), not on a phone. We mock (fake)
// the native phone APIs like expo-sqlite so tests can run without a device.

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Run tests in a Node.js environment (not a browser or phone simulator)
    environment: "node",
    // Makes test functions like describe(), it(), expect() available globally
    // without needing to import them in every test file
    globals: true,
  },
  resolve: {
    alias: {
      // Teach Vitest about the "@/" path alias defined in tsconfig.json
      // so imports like `import { Medicine } from "@/db/schema"` work in tests
      // e.g., "@/db/schema" → "./src/db/schema"
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
