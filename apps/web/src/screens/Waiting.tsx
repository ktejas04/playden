import { Button } from "@playden/ui/components/button";
import { Centered } from "../Shell";

export function Waiting({ onCheckAgain }: { onCheckAgain: () => void }) {
  return (
    <Centered>
      <div className="flex flex-col gap-6">
        <span aria-hidden className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-3 animate-pulse rounded-full bg-primary"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </span>
        <div>
          <h1 className="text-[2rem] leading-tight font-bold tracking-tight">You're on the list</h1>
          <p className="mt-1.5 max-w-prose text-muted-foreground">
            An admin will let you in soon. Once they do, you can create and join rooms. Ping them in
            the group if it's game night.
          </p>
        </div>
        <Button variant="outline" size="lg" className="self-start" onClick={onCheckAgain}>
          Check again
        </Button>
      </div>
    </Centered>
  );
}
