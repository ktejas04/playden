import { cn } from "@playden/ui/lib/utils";

/** A room code shown as ivory letter tiles, the way codes are read out on game night. */
export function RoomCodeTiles({
  code,
  className,
  decorative = false,
}: {
  code: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <div
      className={cn("flex gap-2", className)}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `Room code ${code.split("").join(" ")}`}
    >
      {code.split("").map((letter, index) => (
        <span
          key={index}
          aria-hidden
          className="grid size-14 place-items-center rounded-xl bg-tile font-heading text-3xl font-bold text-tile-foreground shadow-[0_3px_0_0_var(--tile-edge)] sm:size-16 sm:text-4xl"
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
