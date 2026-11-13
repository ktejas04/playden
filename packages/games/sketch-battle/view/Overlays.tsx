import { cn } from "@playden/ui/lib/utils";
import type { ReactNode } from "react";
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

/** S3: the 3-2-1 before drawing starts. */
export function CountdownOverlay({ seconds }: { seconds: number }) {
  return (
    <Over className="bg-background/40">
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

/** S7: how the round went for this team, on its canvas. */
export function ResultOverlay({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <Over className="bg-background/55">
      <div className="duration-300 animate-in zoom-in-95 fade-in-0" role="status">
        <p
          className={cn(
            "font-heading text-2xl font-bold sm:text-3xl",
            tone === "won" && "text-success",
            tone === "lost" && "text-destructive",
          )}
        >
          {title}
        </p>
        <p className="mt-1 text-lg font-semibold">{detail}</p>
      </div>
    </Over>
  );
}

/** A note on the canvas, e.g. a locked canvas or who the next round waits for. */
export function NoteOverlay({ children }: { children: ReactNode }) {
  return (
    <Over className="bg-background/45">
      <p className="max-w-xs font-heading text-lg font-bold" role="status">
        {children}
      </p>
    </Over>
  );
}
