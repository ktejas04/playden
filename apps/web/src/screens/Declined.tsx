import type { Me } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import { toast } from "@playden/ui/components/sonner";
import { useEffect, useState } from "react";
import { askAgain } from "../api";
import { Centered } from "../Shell";

function waitText(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 120) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)} min`;
}

export function Declined({ me, onUpdated }: { me: Me; onUpdated: (me: Me) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const remaining = me.askAgainAt === null ? 0 : Math.max(0, me.askAgainAt - now);

  useEffect(() => {
    if (remaining === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  async function send() {
    setSending(true);
    try {
      onUpdated(await askAgain());
      toast.success("Request sent again");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Couldn't send your request");
    } finally {
      setSending(false);
    }
  }

  return (
    <Centered>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[2rem] leading-tight font-bold tracking-tight">
            Your request wasn't approved
          </h1>
          <p className="mt-1.5 max-w-prose text-muted-foreground">
            An admin didn't recognise this request. Check with whoever invited you, then ask again.
            Make sure your name and "invited by" are ones the group will know.
          </p>
        </div>
        <Button
          size="lg"
          className="self-start"
          disabled={remaining > 0 || sending}
          onClick={() => void send()}
        >
          {remaining > 0
            ? `Ask again in ${waitText(remaining)}`
            : sending
              ? "Sending…"
              : "Ask again"}
        </Button>
      </div>
    </Centered>
  );
}
