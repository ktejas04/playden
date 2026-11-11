import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_GAME_FILES,
  checkIsolation,
  checkLayout,
  checkPurity,
  checkRegistries,
  importsOf,
} from "./architecture.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRIES = ["apps/server/src/games.ts", "apps/web/src/games.ts"];

function readTree(dir, files = new Map()) {
  const absolute = path.join(ROOT, dir);
  if (!existsSync(absolute)) return files;
  for (const entry of readdirSync(absolute, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    const relative = path.relative(ROOT, full).split(path.sep).join("/");
    if (relative.includes("/node_modules/")) continue;
    files.set(relative, readFileSync(full, "utf8"));
  }
  return files;
}

function repoFiles() {
  const files = readTree("packages/games");
  readTree("packages/engine/src", files);
  for (const registry of REGISTRIES) {
    if (existsSync(path.join(ROOT, registry))) {
      files.set(registry, readFileSync(path.join(ROOT, registry), "utf8"));
    }
  }
  return files;
}

describe("this repo", () => {
  const files = repoFiles();

  it("keeps every game to itself", () => {
    expect(checkIsolation(files)).toEqual([]);
  });

  it("keeps engines free of the clock, chance, network and storage", () => {
    expect(checkPurity(files)).toEqual([]);
  });

  it("gives every game the standard layout", () => {
    expect(checkLayout(files)).toEqual([]);
  });

  it("registers every game on the server and the web, and nothing else", () => {
    expect(checkRegistries(files, REGISTRIES)).toEqual([]);
  });
});

/** A minimal valid game folder, for building broken variants. */
function fakeGame(id, overrides = {}) {
  const base = Object.fromEntries(
    REQUIRED_GAME_FILES.map((file) => [`packages/games/${id}/${file}`, ""]),
  );
  base[`packages/games/${id}/package.json`] = JSON.stringify({ name: `@playden/game-${id}` });
  base[`packages/games/${id}/engine.ts`] =
    'import { z } from "zod";\nimport { config } from "./config";';
  base[`packages/games/${id}/tests/engine.test.ts`] = 'import { describe } from "vitest";';
  for (const [file, content] of Object.entries(overrides)) {
    base[`packages/games/${id}/${file}`] = content;
  }
  return Object.fromEntries(Object.entries(base).filter(([, content]) => content !== null));
}

const repo = (...parts) => new Map(parts.flatMap((part) => Object.entries(part)));

describe("the rules catch violations", () => {
  it("a valid fake game passes everything", () => {
    const files = repo(fakeGame("dots"), {
      "apps/server/src/games.ts": 'import { dots } from "@playden/game-dots";',
    });
    expect([
      ...checkIsolation(files),
      ...checkPurity(files),
      ...checkLayout(files),
      ...checkRegistries(files, ["apps/server/src/games.ts"]),
    ]).toEqual([]);
  });

  it("a game importing another game, by package or by path", () => {
    const files = repo(
      fakeGame("dots", {
        "engine.ts": 'import { x } from "@playden/game-lines";',
        "view/Board.tsx": 'import { y } from "../../lines/engine";',
      }),
    );
    expect(checkIsolation(files)).toEqual([
      "packages/games/dots/engine.ts: imports another game package (@playden/game-lines)",
      'packages/games/dots/view/Board.tsx: "../../lines/engine" leaves the dots folder',
    ]);
  });

  it("rules importing React, the view, an app or the test kit", () => {
    const files = repo(
      fakeGame("dots", {
        "engine.ts": [
          'import { useState } from "react";',
          'import { Board } from "./view/Board";',
          'import { x } from "@playden/server";',
          'import { describeGameContract } from "@playden/engine/testing";',
        ].join("\n"),
      }),
    );
    expect(checkIsolation(files)).toEqual([
      "packages/games/dots/engine.ts: rules may only import @playden/engine, zod (got react)",
      'packages/games/dots/engine.ts: rules import the view ("./view/Board")',
      "packages/games/dots/engine.ts: imports an app (@playden/server)",
      "packages/games/dots/engine.ts: rules import the test kit",
    ]);
  });

  it("views and tests may use React and the test kit", () => {
    const files = repo(
      fakeGame("dots", {
        "view/index.tsx":
          'import { useState } from "react";\nimport { Button } from "@playden/ui/components/button";',
        "tests/engine.test.ts": 'import { describeGameContract } from "@playden/engine/testing";',
      }),
    );
    expect(checkIsolation(files)).toEqual([]);
  });

  it("impure engine code, but not inside comments or in views", () => {
    const files = repo(
      fakeGame("dots", {
        "engine.ts":
          "const a = Date.now();\nconst b = Math.random();\n// Date.now() is fine in a comment",
        "view/index.tsx": "const t = Date.now();",
      }),
      { "packages/engine/src/clock.ts": "setTimeout(() => {}, 1);" },
    );
    expect(checkPurity(files)).toEqual([
      "packages/games/dots/engine.ts: uses Date.now(); time and randomness come in as arguments",
      "packages/games/dots/engine.ts: uses Math.random(); time and randomness come in as arguments",
      "packages/engine/src/clock.ts: uses timers; time and randomness come in as arguments",
    ]);
  });

  it("a game missing standard files, tests, or with the wrong package name", () => {
    const files = repo(
      fakeGame("dots", {
        "rules.md": null,
        "tests/engine.test.ts": null,
        "package.json": JSON.stringify({ name: "dots" }),
      }),
    );
    expect(checkLayout(files)).toEqual([
      "dots: missing rules.md",
      "dots: has no tests",
      'dots: package is "dots", expected "@playden/game-dots"',
    ]);
  });

  it("a game that isn't registered, and a registry entry with no game", () => {
    const files = repo(fakeGame("dots"), {
      "apps/web/src/games.ts": 'import { lines } from "@playden/game-lines/view";',
    });
    expect(checkRegistries(files, ["apps/web/src/games.ts", "apps/server/src/games.ts"])).toEqual([
      "apps/web/src/games.ts: dots isn't registered",
      "apps/web/src/games.ts: lines has no game folder",
      "apps/server/src/games.ts is missing",
    ]);
  });

  it("finds static, re-exported, side-effect, dynamic and require imports", () => {
    const source = [
      'import a from "one";',
      'import type { B } from "two";',
      'export { c } from "three";',
      'import "four";',
      'const d = await import("five");',
      'const e = require("six");',
      '// import x from "comment";',
    ].join("\n");
    expect(importsOf(source).sort()).toEqual(["five", "four", "one", "six", "three", "two"]);
  });
});
