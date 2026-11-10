import { Centered } from "../Shell";

export function Banned() {
  return (
    <Centered>
      <h1 className="text-[2rem] leading-tight font-bold tracking-tight">
        Your access was removed
      </h1>
      <p className="mt-1.5 max-w-prose text-muted-foreground">
        You can't create or join rooms any more. If you think this is a mistake, ask an admin in the
        group.
      </p>
    </Centered>
  );
}
