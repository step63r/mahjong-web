import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "domain",
      root: "./packages/domain",
      include: ["src/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**"],
    },
  },
  {
    test: {
      name: "shared",
      root: "./packages/shared",
      include: ["src/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**"],
    },
  },
  {
    test: {
      name: "server",
      root: "./packages/server",
      include: ["src/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**"],
    },
  },
  {
    test: {
      name: "client",
      root: "./packages/client",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      exclude: ["dist/**", "node_modules/**"],
    },
  },
]);
