import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Module boundaries from docs/PROJECT.md "Code practices and modularity".
function restrictImports(files, group) {
  return {
    files,
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group, message: "Crosses a module boundary (see docs/PROJECT.md)." }] },
      ],
    },
  };
}

const appPaths = ["**/apps/**", "@playden/web", "@playden/server"];

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.wrangler/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
    },
  },
  restrictImports(["packages/engine/**"], ["@playden/*", ...appPaths, "**/packages/**"]),
  restrictImports(
    ["packages/protocol/**"],
    ["@playden/*", "!@playden/engine", ...appPaths, "**/games/**"],
  ),
  restrictImports(
    ["packages/ui/**"],
    ["@playden/*", "!@playden/engine", "!@playden/protocol", ...appPaths, "**/games/**"],
  ),
  restrictImports(
    ["packages/games/**"],
    ["@playden/*", "!@playden/engine", "!@playden/protocol", "!@playden/ui", ...appPaths],
  ),
  restrictImports(
    ["apps/server/**"],
    [
      "@playden/ui",
      "@playden/web",
      "**/apps/web/**",
      "@playden/game-*/view",
      "@playden/game-*/view/*",
    ],
  ),
  restrictImports(["apps/web/**"], ["@playden/server", "**/apps/server/**"]),
);
