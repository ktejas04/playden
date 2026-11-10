import { type Me, profileSchema } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import { Input } from "@playden/ui/components/input";
import { Label } from "@playden/ui/components/label";
import { type FormEvent, useState } from "react";
import { saveProfile } from "../api";
import { Centered, Panel } from "../Shell";

export function Profile({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const [displayName, setDisplayName] = useState(me.displayName ?? "");
  const [invitedBy, setInvitedBy] = useState(me.invitedBy ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = profileSchema.safeParse({ displayName, invitedBy });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveProfile(parsed.data));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Centered>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[2rem] leading-tight font-bold tracking-tight">One last thing</h1>
          <p className="mt-1.5 text-muted-foreground">
            Pick the name your friends will see in rooms. Signed in as {me.email}.
          </p>
        </div>
        <Panel>
          <form onSubmit={submit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Your name in rooms</Label>
              <Input
                id="displayName"
                className="h-12 rounded-xl text-base"
                autoComplete="nickname"
                placeholder="What the group calls you"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invitedBy">Who invited you?</Label>
              <Input
                id="invitedBy"
                className="h-12 rounded-xl text-base"
                placeholder="So the admin knows you"
                value={invitedBy}
                onChange={(e) => setInvitedBy(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Saving…" : "Save and continue"}
            </Button>
          </form>
        </Panel>
      </div>
    </Centered>
  );
}
