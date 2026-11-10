import { Avatar, AvatarFallback } from "@playden/ui/components/avatar";
import { cn } from "@playden/ui/lib/utils";
import { initials } from "../initials";
import { playerColor } from "../playerColor";

// `!` beats the fallback's default muted colours regardless of class order.
const COLOR_CLASS = [
  "bg-player-1!",
  "bg-player-2!",
  "bg-player-3!",
  "bg-player-4!",
  "bg-player-5!",
] as const;

export function PlayerAvatar({
  id,
  name,
  size = "default",
}: {
  id: string;
  name: string;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size}>
      <AvatarFallback
        className={cn("font-heading font-semibold text-[#1c1606]!", COLOR_CLASS[playerColor(id)])}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
