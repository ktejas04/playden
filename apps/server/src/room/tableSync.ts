import type { AnyGame, GameEvent } from "@playden/engine";
import type { ServerMessage } from "@playden/protocol";
import { findGame } from "../games";
import { EMPTY_TABLE, type TableState, nextDeadline, statusOf, viewFor } from "./roomGame";

const TABLE_KEY = "table";

export async function loadTable(storage: DurableObjectStorage): Promise<TableState> {
  return (await storage.get<TableState>(TABLE_KEY)) ?? EMPTY_TABLE;
}

export async function saveTable(storage: DurableObjectStorage, table: TableState): Promise<void> {
  await storage.put(TABLE_KEY, table);
}

export function gameOf(table: TableState): AnyGame | undefined {
  return table.session ? findGame(table.session.gameId) : undefined;
}

export function tableDeadline(table: TableState): number | null {
  const game = gameOf(table);
  return game ? nextDeadline(table, game) : null;
}

/**
 * What one connection should hear after the table changes: the status when it changed (or
 * always, for a fresh connection), then this viewer's own view and the events, but only for
 * players and spectators of a running or finished game.
 */
export function messagesFor(
  table: TableState,
  viewerId: string,
  { statusChanged, events }: { statusChanged: boolean; events: GameEvent[] },
): ServerMessage[] {
  const messages: ServerMessage[] = [];
  if (statusChanged) messages.push(statusOf(table));
  const game = gameOf(table);
  const view = game ? viewFor(table, game, viewerId) : null;
  if (view !== null) {
    messages.push({ type: "game.view", view });
    if (events.length > 0) messages.push({ type: "game.events", events });
  }
  return messages;
}

export function statusChangedBetween(before: TableState, after: TableState): boolean {
  return JSON.stringify(statusOf(before)) !== JSON.stringify(statusOf(after));
}
