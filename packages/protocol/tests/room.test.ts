import { describe, expect, it } from "vitest";
import { canRemovePlayer } from "../src";

const host = { id: "host", isAdmin: false };
const admin = { id: "admin", isAdmin: true };
const otherAdmin = { id: "admin-2", isAdmin: true };
const player = { id: "player", isAdmin: false };
const otherPlayer = { id: "player-2", isAdmin: false };

describe("canRemovePlayer", () => {
  it("lets the host remove a player", () => {
    expect(canRemovePlayer(host, player, host.id)).toBe(true);
  });

  it("lets an admin remove a player, even when someone else is host", () => {
    expect(canRemovePlayer(admin, player, host.id)).toBe(true);
  });

  it("lets an admin remove the host", () => {
    expect(canRemovePlayer(admin, host, host.id)).toBe(true);
  });

  it("refuses a player who is neither host nor admin", () => {
    expect(canRemovePlayer(player, otherPlayer, host.id)).toBe(false);
    expect(canRemovePlayer(player, host, host.id)).toBe(false);
  });

  it("refuses removing an admin, for the host and for other admins", () => {
    expect(canRemovePlayer(host, admin, host.id)).toBe(false);
    expect(canRemovePlayer(otherAdmin, admin, host.id)).toBe(false);
  });

  it("refuses removing yourself", () => {
    expect(canRemovePlayer(host, host, host.id)).toBe(false);
    expect(canRemovePlayer(admin, admin, admin.id)).toBe(false);
  });
});
