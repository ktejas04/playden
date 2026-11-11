// `pnpm new-game <id> "<Name>"`: creates packages/games/<id> with the standard layout and a
// small working game that already passes the contract kit, then registers it on the server
// and the web. Replace the template rules with the real ones, tests first.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const [id, name] = process.argv.slice(2);
if (!id || !name)
  fail('Usage: pnpm new-game <id> "<Name>"   e.g. pnpm new-game tap-race "Tap Race"');
if (!ID_PATTERN.test(id)) fail(`"${id}" must be lowercase words joined by hyphens, e.g. tap-race`);
const dir = join(root, "packages/games", id);
if (existsSync(dir)) fail(`packages/games/${id} already exists`);

const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = camel[0].toUpperCase() + camel.slice(1);
const pkg = `@playden/game-${id}`;
const versions = JSON.parse(readFileSync(join(root, "apps/web/package.json"), "utf8"));
const reactVersion = versions.dependencies.react;
const reactTypes = versions.devDependencies["@types/react"];
const zodVersion = JSON.parse(readFileSync(join(root, "packages/engine/package.json"), "utf8"))
  .dependencies.zod;

const files = {
  "package.json": `${JSON.stringify(
    {
      name: pkg,
      version: "0.0.0",
      private: true,
      type: "module",
      exports: { ".": "./index.ts", "./view": "./view/index.tsx" },
      scripts: { typecheck: "tsc -p ." },
      dependencies: {
        "@playden/engine": "workspace:*",
        "@playden/ui": "workspace:*",
        react: reactVersion,
        zod: zodVersion,
      },
      devDependencies: { "@types/react": reactTypes },
    },
    null,
    2,
  )}\n`,

  "tsconfig.json": `${JSON.stringify(
    {
      extends: "../../../tsconfig.base.json",
      compilerOptions: { lib: ["ES2022", "DOM", "DOM.Iterable"], jsx: "react-jsx" },
      include: ["**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    },
    null,
    2,
  )}\n`,

  "types.ts": `export interface ${pascal}Config {
  roundSeconds: number;
}

export type ${pascal}Move = { type: "done" };

export interface ${pascal}State {
  players: string[];
  done: string[];
  endsAt: number;
  over: boolean;
}

export interface ${pascal}View {
  done: string[];
  endsAt: number;
  over: boolean;
}
`,

  "config.ts": `import { z } from "zod";
import type { ${pascal}Config } from "./types";

export const DEFAULT_CONFIG: ${pascal}Config = {
  roundSeconds: 60,
};

export const configSchema = z.strictObject({
  roundSeconds: z.number().int().min(5).max(600),
});
`,

  "engine.ts": `import type { GameDefinition } from "@playden/engine";
import { z } from "zod";
import { DEFAULT_CONFIG, configSchema } from "./config";
import type { ${pascal}Config, ${pascal}Move, ${pascal}State, ${pascal}View } from "./types";

// Template rules: everyone taps Done, or time runs out. Replace with the real game, tests first.
export const ${camel}: GameDefinition<${pascal}State, ${pascal}Move, ${pascal}View, ${pascal}Config> = {
  id: "${id}",
  name: "${name}",
  summary: "Describe the game in one line.",
  minPlayers: 1,
  maxPlayers: 16,
  devOnly: true,

  defaultConfig: DEFAULT_CONFIG,
  configSchema,
  moveSchema: z.strictObject({ type: z.literal("done") }),

  setup: (seats, config, _seed, now) => ({
    players: seats.map((seat) => seat.id),
    done: [],
    endsAt: now + config.roundSeconds * 1000,
    over: false,
  }),

  validate: (state, playerId) => {
    if (state.over) return { ok: false, reason: "The game is over" };
    if (!state.players.includes(playerId)) return { ok: false, reason: "You're watching this game" };
    if (state.done.includes(playerId)) return { ok: false, reason: "You're already done" };
    return { ok: true };
  },

  apply: (state, playerId) => {
    const done = [...state.done, playerId];
    const over = state.players.every((id) => done.includes(id));
    return { state: { ...state, done, over }, events: [{ type: "done", data: { playerId } }] };
  },

  view: (state) => ({ done: state.done, endsAt: state.endsAt, over: state.over }),
  nextDeadline: (state) => (state.over ? null : state.endsAt),
  onDeadline: (state) => ({ state: { ...state, over: true }, events: [{ type: "timeUp" }] }),

  onPlayerLeft: (state, playerId) => {
    const players = state.players.filter((id) => id !== playerId);
    const over = state.over || players.every((id) => state.done.includes(id));
    return { state: { ...state, players, over }, events: [] };
  },

  result: (state) =>
    state.over
      ? {
          scores: Object.fromEntries(state.players.map((id) => [id, state.done.includes(id) ? 1 : 0])),
          winners: state.players.filter((id) => state.done.includes(id)),
        }
      : null,
};
`,

  "index.ts": `export { ${camel} } from "./engine";
export type * from "./types";
`,

  "rules.md": `# ${name}

Write the 60-second rules card here: the goal, a turn, how you win, scoring.
`,

  "view/index.tsx": `import type { GameViewProps } from "@playden/engine";
import { Button } from "@playden/ui/components/button";
import type { ${pascal}Move, ${pascal}View } from "../types";

export function ${pascal}Screen({ view, me, sendMove }: GameViewProps<${pascal}View, ${pascal}Move>) {
  const isDone = view.done.includes(me);
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <p className="text-muted-foreground">{view.done.length} done</p>
      {!view.over && me !== "spectator" && (
        <Button size="xl" disabled={isDone} onClick={() => sendMove({ type: "done" })}>
          {isDone ? "Waiting for others" : "Done"}
        </Button>
      )}
      {view.over && <p className="text-lg font-semibold">Game over</p>}
    </div>
  );
}
`,

  "tests/engine.test.ts": `import { describeGameContract } from "@playden/engine/testing";
import { describe, expect, it } from "vitest";
import { ${camel} } from "../engine";

const seats = [
  { id: "a", name: "Asha" },
  { id: "b", name: "Ben" },
];
const START = 1_000_000;

describeGameContract(${camel}, {
  seats,
  sampleMoves: () => [{ type: "done" }],
});

describe("${name}", () => {
  it("ends once everyone is done", () => {
    let state = ${camel}.setup(seats, ${camel}.defaultConfig, 1, START);
    state = ${camel}.apply(state, "a", { type: "done" }, START + 1).state;
    expect(${camel}.result(state)).toBeNull();
    state = ${camel}.apply(state, "b", { type: "done" }, START + 2).state;
    expect(${camel}.result(state)?.winners).toEqual(["a", "b"]);
  });

  it("rejects a spectator", () => {
    const state = ${camel}.setup(seats, ${camel}.defaultConfig, 1, START);
    expect(${camel}.validate(state, "zed", { type: "done" }, START)).toEqual({
      ok: false,
      reason: "You're watching this game",
    });
  });
});
`,
};

for (const [file, content] of Object.entries(files)) {
  const target = join(dir, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

/** Adds `entry` to the `export const GAMES ... = [...]` list in a registry, plus its import. */
function register(relative, importLine, entry) {
  const file = join(root, relative);
  let source = readFileSync(file, "utf8");
  const list = /(export const GAMES[^=]*=\s*\[)([\s\S]*?)(\];)/;
  const match = source.match(list);
  if (!match) fail(`Couldn't find the GAMES list in ${relative}`);
  const entries = match[2]
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean);
  entries.push(entry);
  entries.sort();
  source = source.replace(list, `$1\n${entries.map((e) => `  ${e},`).join("\n")}\n$3`);
  const imports = [...source.matchAll(/^import .*;$/gm)];
  const last = imports[imports.length - 1];
  const at = last.index + last[0].length;
  source = `${source.slice(0, at)}\n${importLine}${source.slice(at)}`;
  writeFileSync(file, source);
}

register("apps/server/src/games.ts", `import { ${camel} } from "${pkg}";`, camel);
register(
  "apps/web/src/games.ts",
  `import { ${camel} } from "${pkg}";\nimport { ${pascal}Screen } from "${pkg}/view";`,
  `webGame(${camel}, ${pascal}Screen)`,
);

for (const app of ["apps/server/package.json", "apps/web/package.json"]) {
  const file = join(root, app);
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  manifest.dependencies = Object.fromEntries(
    Object.entries({ ...manifest.dependencies, [pkg]: "workspace:*" }).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  );
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

function run(label, command) {
  console.log(`▸ ${label}`);
  const result = spawnSync(command, { cwd: root, shell: true, stdio: "inherit" });
  if (result.status !== 0) fail(`"${label}" failed`);
}

run("Installing", "pnpm install");
run(
  "Formatting",
  `pnpm exec prettier --write packages/games/${id} apps/server/src/games.ts apps/web/src/games.ts apps/server/package.json apps/web/package.json`,
);

console.log(`
✓ Created ${pkg} in packages/games/${id} and registered it.
  Next: write docs/games/${id}.md, then replace the template rules in engine.ts, tests first.
  Remove it later by deleting packages/games/${id} and its lines in both games.ts files and app package.json files.`);
