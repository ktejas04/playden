import { type Me, profileSchema } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@playden/ui/components/card";
import { Input } from "@playden/ui/components/input";
import { Label } from "@playden/ui/components/label";
import { type FormEvent, useState } from "react";
import { saveProfile } from "../api";
import { Centered } from "../Shell";

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
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Nearly there</CardTitle>
          <CardDescription>Signed in as {me.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Your name in rooms</Label>
              <Input
                id="displayName"
                className="h-11"
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invitedBy">Who invited you?</Label>
              <Input
                id="invitedBy"
                className="h-11"
                value={invitedBy}
                onChange={(e) => setInvitedBy(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-11" disabled={saving}>
              {saving ? "Saving…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Centered>
  );
}
