import { Badge } from "@playden/ui/components/badge";
import { Button } from "@playden/ui/components/button";
import { cn } from "@playden/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { listWebGames } from "../games";
import { Panel } from "../Shell";

/** Dev-only games (Tap Race) are offered only by the local dev server's build. */
const offered = () => listWebGames({ includeDevOnly: import.meta.env.DEV });

/** Every game on offer, as big tappable rows; the picked one is marked. */
export function GameList({
  pickedId,
  onPick,
}: {
  pickedId: string | null;
  onPick: (gameId: string) => void;
}) {
  const games = offered();
  if (games.length === 0) {
    return (
      <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        No games are ready yet. Sketch Battle is on its way.
      </p>
    );
  }
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {games.map(({ definition }) => {
        const selected = definition.id === pickedId;
        return (
          <li key={definition.id}>
            <Button
              variant="outline"
              aria-pressed={selected}
              onClick={() => onPick(definition.id)}
              className={cn(
                "h-auto w-full justify-start gap-3 px-4 py-3 text-left whitespace-normal",
                selected && "border-primary bg-primary/15 hover:bg-primary/20",
              )}
            >
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-base">
                  {definition.name}
                  {definition.devOnly && (
                    <Badge variant="outline" className="font-sans text-xs font-medium">
                      Dev only
                    </Badge>
                  )}
                </span>
                <span className="font-sans text-sm font-normal text-muted-foreground">
                  {definition.summary}
                </span>
              </span>
              {selected && <CheckIcon className="size-5 shrink-0 text-primary" />}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** On the idle room screen: the host picks a game; everyone else waits for it. */
export function GamePicker({
  isHost,
  onPick,
}: {
  isHost: boolean;
  onPick: (gameId: string) => void;
}) {
  return (
    <Panel className="mt-4">
      <h2 className="text-lg font-semibold">{isHost ? "Pick a game" : "Game"}</h2>
      {isHost ? (
        <GameList pickedId={null} onPick={onPick} />
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">The host is picking a game.</p>
      )}
    </Panel>
  );
}
