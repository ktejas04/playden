import { GAME_ID_PATTERN } from "@playden/engine";
import { checkMetadata } from "@playden/engine/testing";
import { describe, expect, it } from "vitest";
import { GAMES, findGame, listGames } from "../src/games";

describe("server game registry", () => {
  it("has unique, valid ids and every game passes the metadata checks", () => {
    const ids = GAMES.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const game of GAMES) {
      expect(game.id).toMatch(GAME_ID_PATTERN);
      expect(checkMetadata(game)).toEqual([]);
    }
  });

  it("finds a game by id", () => {
    expect(findGame("tap-race")?.name).toBe("Tap Race");
    expect(findGame("no-such-game")).toBeUndefined();
  });

  it("hides dev-only games unless they're allowed", () => {
    expect(listGames({ includeDevOnly: true }).map((g) => g.id)).toContain("tap-race");
    expect(listGames({ includeDevOnly: false }).some((g) => g.devOnly)).toBe(false);
  });
});
