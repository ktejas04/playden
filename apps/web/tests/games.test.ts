import { describe, expect, it } from "vitest";
import { GAMES, findWebGame, listWebGames } from "../src/games";

describe("web game registry", () => {
  it("pairs every game with a screen, with unique ids", () => {
    const ids = GAMES.map((game) => game.definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const game of GAMES) expect(typeof game.View).toBe("function");
  });

  it("finds a game by id", () => {
    expect(findWebGame("tap-race")?.definition.name).toBe("Tap Race");
    expect(findWebGame("no-such-game")).toBeUndefined();
  });

  it("hides dev-only games unless they're allowed; Tap Race is live", () => {
    expect(listWebGames({ includeDevOnly: false }).map((g) => g.definition.id)).toContain(
      "tap-race",
    );
    expect(listWebGames({ includeDevOnly: false }).some((g) => g.definition.devOnly)).toBe(false);
    expect(listWebGames({ includeDevOnly: true }).length).toBe(GAMES.length);
  });
});
