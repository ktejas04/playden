import { describe, expect, it } from "vitest";
import { canRemovePlayer } from "../src";

const host = "host";
const player = "player";
const otherPlayer = "player-2";
const admin = "admin";

describe("canRemovePlayer (D59)", () => {
  it("lets the host remove a player", () => {
    expect(canRemovePlayer(host, player, host)).toBe(true);
  });

  it("lets the host remove an admin: admins are regular people in a room", () => {
    expect(canRemovePlayer(host, admin, host)).toBe(true);
  });

  it("refuses an admin who isn't host", () => {
    expect(canRemovePlayer(admin, player, host)).toBe(false);
    expect(canRemovePlayer(admin, host, host)).toBe(false);
  });

  it("lets an admin who is host remove people", () => {
    expect(canRemovePlayer(admin, player, admin)).toBe(true);
  });

  it("refuses anyone else", () => {
    expect(canRemovePlayer(player, otherPlayer, host)).toBe(false);
    expect(canRemovePlayer(player, host, host)).toBe(false);
  });

  it("refuses removing yourself", () => {
    expect(canRemovePlayer(host, host, host)).toBe(false);
  });
});
