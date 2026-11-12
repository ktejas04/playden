import { Badge } from "@playden/ui/components/badge";
import { CrownIcon } from "lucide-react";

/** Marks the room's host, the same everywhere a player is listed. */
export function HostBadge() {
  return (
    <Badge
      variant="outline"
      className="h-6 gap-1 px-2 text-sm duration-300 animate-in fade-in-0 zoom-in-90"
    >
      <CrownIcon className="size-3.5! text-warning" /> Host
    </Badge>
  );
}
