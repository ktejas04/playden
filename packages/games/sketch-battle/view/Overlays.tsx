import { Button } from "@playden/ui/components/button";
import { cn } from "@playden/ui/lib/utils";
import { ArrowRight, Clock, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import type { SketchBattleMove, SketchBattleView } from "../types";
import type { Tone } from "./result";

/** A layer over the canvas with one message; the canvas underneath stays as it was. */
function Over({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 grid place-items-center p-4 text-center backdrop-blur-[2px] duration-300 animate-in fade-in-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * S2, on the canvas: both drawers see the two words, only the chooser can tap one. The words
 * look the same so neither reads as the suggested pick. Everyone else sees who is choosing.
 * Through the 3-2-1 that follows, the picked word is marked and the other fades (SB20).
 */
export function ChooseOverlay({
  view,
  seconds,
  sendMove,
}: {
  view: SketchBattleView;
  seconds: number | null;
  sendMove: (move: SketchBattleMove) => void;
}) {
  const chooser =
    view.teams.flatMap((t) => t.players).find((p) => p.id === view.chooserId)?.name ?? "Someone";
  const iChoose =
    view.me.role === "drawer" && view.teams[view.me.team ?? 0].drawerId === view.chooserId;
  const picked = view.phase === "countdown" ? view.word : null;

  return (
    <Over className="bg-background/85">
      {seconds !== null && (
        <span className="absolute top-3 right-4 font-heading text-lg font-bold text-muted-foreground tabular-nums">
          {seconds}
        </span>
      )}
      <div className="flex w-full max-w-64 flex-col items-center gap-4">
        <p className="font-heading text-xl font-bold">
          {picked
            ? iChoose
              ? "your word"
              : `${chooser} picked`
            : iChoose
              ? "choose a word"
              : `${chooser} is choosing a word`}
        </p>
        {view.choices && (
          <div className="flex w-full flex-col gap-2.5">
            {view.choices.map((word, i) =>
              picked ? (
                <div key={word} className="relative">
                  {word === picked && (
                    <ArrowRight
                      className="absolute top-1/2 right-full mr-2 size-5 -translate-y-1/2 text-primary duration-300 animate-in fade-in-0 slide-in-from-left-2"
                      aria-hidden
                    />
                  )}
                  <Button
                    variant={word === picked ? "default" : "outline"}
                    size="lg"
                    disabled
                    aria-label={word === picked ? `${word}, picked` : word}
                    className={cn(
                      "w-full font-heading text-lg font-bold transition-opacity duration-300 disabled:opacity-100",
                      word !== picked && "bg-card opacity-35 disabled:opacity-35",
                    )}
                  >
                    {word}
                  </Button>
                </div>
              ) : (
                <Button
                  key={word}
                  variant="outline"
                  size="lg"
                  disabled={!iChoose}
                  className="w-full bg-card font-heading text-lg font-bold disabled:opacity-70"
                  onClick={() => sendMove({ type: "choose", index: i as 0 | 1 })}
                >
                  {word}
                </Button>
              ),
            )}
          </div>
        )}
      </div>
    </Over>
  );
}

/** S3: the 3-2-1 before drawing starts. */
export function CountdownOverlay({ seconds }: { seconds: number }) {
  return (
    // The same backing as the other canvas messages, so the number reads in both themes.
    <Over className="bg-background/80 dark:bg-background/85">
      <span
        key={seconds}
        className="font-heading text-7xl font-bold text-foreground duration-300 animate-in zoom-in-50 fade-in-0"
        aria-live="assertive"
      >
        {Math.max(1, seconds)}
      </span>
    </Over>
  );
}

/** S7: how the round went for this team, on its canvas. Matches reference: trophy on win, clock on timeout. */
export function ResultOverlay({
  title,
  detail,
  tone,
  showTrophy,
}: {
  title: string;
  detail: string;
  tone: Tone;
  showTrophy?: boolean;
}) {
  const isWon = tone === "won" || showTrophy;
  const isTimeout = title.toLowerCase().includes("time's up");

  return (
    <Over className="bg-background/80 dark:bg-background/85">
      <div
        className="flex flex-col items-center justify-center duration-300 animate-in zoom-in-95 fade-in-0"
        role="status"
      >
        {isWon && (
          <Trophy
            className="mb-2 size-14 text-amber-500 drop-shadow-sm"
            strokeWidth={1.75}
            aria-hidden
          />
        )}
        {!isWon && isTimeout && (
          <Clock className="mb-2 size-12 text-muted-foreground/80" strokeWidth={1.75} aria-hidden />
        )}
        <p
          className={cn(
            "font-heading text-2xl font-bold sm:text-3xl",
            tone === "won" && "text-foreground",
            tone === "lost" && "text-rose-600 dark:text-rose-400",
            tone === "neutral" && "text-foreground",
          )}
        >
          {title}
        </p>
        <p className="mt-1 text-base font-semibold text-muted-foreground">{detail}</p>
      </div>
    </Over>
  );
}

/** A note on the canvas, e.g. a locked canvas or who the next round waits for. */
export function NoteOverlay({ children }: { children: ReactNode }) {
  return (
    <Over className="bg-background/60">
      <p className="max-w-xs font-heading text-lg font-bold" role="status">
        {children}
      </p>
    </Over>
  );
}
