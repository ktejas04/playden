// Architecture rules from docs/PROJECT.md "Code practices and modularity", checked by
// machine so games stay isolated and engines stay pure. Every rule is a pure function over
// `files`: a Map of repo-relative paths ("packages/games/x/engine.ts") to file contents.

import path from "node:path";

const GAMES_DIR = "packages/games";
const SOURCE = /\.(ts|tsx|mts)$/;

/** Files every game folder must have, relative to it. */
export const REQUIRED_GAME_FILES = [
  "package.json",
  "tsconfig.json",
  "config.ts",
  "types.ts",
  "engine.ts",
  "index.ts",
  "rules.md",
  "view/index.tsx",
];

/** What a game's rules (everything but view/ and tests/) may import from outside itself. */
const ENGINE_ALLOWED_PACKAGES = ["@playden/engine", "zod"];

/** Calls that make an engine depend on the clock, chance, the network or storage. */
const IMPURE = [
  [/\bDate\.now\s*\(/, "Date.now()"],
  [/\bnew\s+Date\s*\(/, "new Date()"],
  [/\bMath\.random\s*\(/, "Math.random()"],
  [/\bperformance\.now\s*\(/, "performance.now()"],
  [/\bfetch\s*\(/, "fetch()"],
  [/\bset(Timeout|Interval)\s*\(/, "timers"],
  [/\bcrypto\./, "crypto"],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, "browser storage"],
];

/** Game ids, from the folders that hold a package.json. */
export function gameIds(files) {
  const ids = new Set();
  for (const file of files.keys()) {
    const match = file.match(/^packages\/games\/([^/]+)\/package\.json$/);
    if (match) ids.add(match[1]);
  }
  return [...ids].sort();
}

function gameFolders(files) {
  const ids = new Set();
  for (const file of files.keys()) {
    const match = file.match(/^packages\/games\/([^/]+)\//);
    if (match) ids.add(match[1]);
  }
  return [...ids].sort();
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

export function importsOf(source) {
  const specifiers = [];
  const patterns = [
    /\b(?:import|export)\s[^"'`;]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  const code = stripComments(source);
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

function packageOf(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** Where a game file sits: its game id and whether it's rules, view or tests code. */
function locate(file) {
  const match = file.match(/^packages\/games\/([^/]+)\/(.*)$/);
  if (!match) return null;
  const [, id, rest] = match;
  const area = rest.startsWith("view/") ? "view" : rest.startsWith("tests/") ? "tests" : "rules";
  return { id, rest, area };
}

/** No game reaches into another game, an app, or outside its own folder. */
export function checkIsolation(files) {
  const problems = [];
  for (const [file, source] of files) {
    const where = locate(file);
    if (!where || !SOURCE.test(file)) continue;
    const root = `${GAMES_DIR}/${where.id}`;
    for (const specifier of importsOf(source)) {
      if (specifier.startsWith(".")) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        if (!target.startsWith(`${root}/`)) {
          problems.push(`${file}: "${specifier}" leaves the ${where.id} folder`);
        } else if (where.area === "rules" && target.startsWith(`${root}/view`)) {
          problems.push(`${file}: rules import the view ("${specifier}")`);
        }
        continue;
      }
      const pkg = packageOf(specifier);
      if (pkg.startsWith("@playden/game-")) {
        problems.push(`${file}: imports another game package (${specifier})`);
      } else if (pkg === "@playden/web" || pkg === "@playden/server") {
        problems.push(`${file}: imports an app (${specifier})`);
      } else if (where.area === "rules" && !ENGINE_ALLOWED_PACKAGES.includes(pkg)) {
        problems.push(
          `${file}: rules may only import ${ENGINE_ALLOWED_PACKAGES.join(", ")} (got ${specifier})`,
        );
      } else if (where.area === "rules" && specifier === "@playden/engine/testing") {
        problems.push(`${file}: rules import the test kit`);
      }
    }
  }
  return problems;
}

/** Engine code (the shared engine and every game's rules) uses no clock, chance, network or storage. */
export function checkPurity(files) {
  const problems = [];
  for (const [file, source] of files) {
    const where = locate(file);
    const isEngine = file.startsWith("packages/engine/src/") && !file.includes("/testing/");
    const isRules = where?.area === "rules";
    if (!(isEngine || isRules) || !SOURCE.test(file)) continue;
    const code = stripComments(source);
    for (const [pattern, label] of IMPURE) {
      if (pattern.test(code))
        problems.push(`${file}: uses ${label}; time and randomness come in as arguments`);
    }
  }
  return problems;
}

/** Every game has the standard files and the right package name. */
export function checkLayout(files) {
  const problems = [];
  for (const id of gameFolders(files)) {
    for (const required of REQUIRED_GAME_FILES) {
      if (!files.has(`${GAMES_DIR}/${id}/${required}`)) problems.push(`${id}: missing ${required}`);
    }
    if (
      ![...files.keys()].some(
        (f) => f.startsWith(`${GAMES_DIR}/${id}/tests/`) && f.endsWith(".test.ts"),
      )
    ) {
      problems.push(`${id}: has no tests`);
    }
    const manifest = files.get(`${GAMES_DIR}/${id}/package.json`);
    if (manifest) {
      const { name } = JSON.parse(manifest);
      if (name !== `@playden/game-${id}`)
        problems.push(`${id}: package is "${name}", expected "@playden/game-${id}"`);
    }
  }
  return problems;
}

/** The game folders and the server and web registries list exactly the same games. */
export function checkRegistries(files, registries) {
  const problems = [];
  const ids = gameIds(files);
  for (const registry of registries) {
    const source = files.get(registry);
    if (source === undefined) {
      problems.push(`${registry} is missing`);
      continue;
    }
    const listed = new Set(
      importsOf(source)
        .map((s) => s.match(/^@playden\/game-([^/]+)/)?.[1])
        .filter(Boolean),
    );
    for (const id of ids) if (!listed.has(id)) problems.push(`${registry}: ${id} isn't registered`);
    for (const id of listed)
      if (!ids.includes(id)) problems.push(`${registry}: ${id} has no game folder`);
  }
  return problems;
}
