import { describe, expect, it } from "vitest";
import type { GameDefinition } from "../GameDefinition";
import { type ContractFixture, checkMetadata, checkPlaythrough, checkSetup } from "./contract";

export { type ContractFixture, checkMetadata, checkPlaythrough, checkSetup } from "./contract";
export { deepFreeze, firstNonJson, sameJson } from "./json";

/**
 * The checks every game must pass, as Vitest tests. Call it from each game's tests:
 * `describeGameContract(myGame, { seats, sampleMoves })`.
 */
export function describeGameContract<S, M, V, C, D>(
  game: GameDefinition<S, M, V, C, D>,
  fixture: ContractFixture<S, M, C>,
): void {
  describe(`${game.id} follows the game contract`, () => {
    it("has valid metadata and settings", () => {
      expect(checkMetadata(game)).toEqual([]);
    });

    it("sets up the same way for the same seed, as plain JSON, with no result yet", () => {
      expect(checkSetup(game, fixture)).toEqual([]);
    });

    for (const seed of fixture.seeds ?? [1, 2, 3]) {
      it(`plays a random game to the end with seed ${seed}`, () => {
        expect(checkPlaythrough(game, fixture, seed)).toEqual([]);
      });
    }
  });
}
