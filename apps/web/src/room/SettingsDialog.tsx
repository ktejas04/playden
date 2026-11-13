import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@playden/ui/components/dialog";
import { useEffect, useState } from "react";
import type { WebGame } from "../games";

/**
 * The platform's wrapper around a game's settings (docs/design/rooms-and-games.md, Settings),
 * opened from the Settings button in setup. It knows nothing about any game's settings: it
 * shows the game's own `Settings` view. The host can change them (each change goes to the
 * room, which checks it with the game's schema; it shows at once, then the server's answer
 * replaces it). Everyone else sees the same view as plain values, kept up to date live.
 * Changes save as they're made, so there's no Done button: ✕, a tap outside or back closes it.
 */
export function SettingsDialog({
  game,
  config,
  canEdit,
  open,
  onOpenChange,
  onChange,
}: {
  game: WebGame;
  config: unknown;
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (config: unknown) => void;
}) {
  const [draft, setDraft] = useState(config);
  useEffect(() => setDraft(config), [config]);
  const { Settings } = game;
  if (!Settings) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-2 p-6 sm:max-w-md" closeLabel="Close settings">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold">
            {game.definition.name} settings
          </DialogTitle>
          {!canEdit && <DialogDescription>Only the host can change these.</DialogDescription>}
        </DialogHeader>
        <Settings
          config={draft}
          canEdit={canEdit}
          onChange={(next) => {
            if (!canEdit) return;
            setDraft(next);
            onChange(next);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
