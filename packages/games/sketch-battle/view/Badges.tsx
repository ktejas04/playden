import { Badge } from "@playden/ui/components/badge";
import { cn } from "@playden/ui/lib/utils";
import { TimerIcon, TrophyIcon } from "lucide-react";
import type { ReactNode } from "react";
import { STREAK_BADGE_MIN_WINS } from "../config";
import type { SketchBattleView, TeamIndex } from "../types";

const look =
  "h-6 gap-1 border-warning/40 bg-warning/15 px-2.5 text-sm font-semibold text-foreground";

/** "3x streak": the staying drawer's wins in a row. */
export function StreakBadge({ count, className }: { count: number; className?: string }) {
  return (
    <Badge variant="outline" className={cn(look, className)} data-tour="streak-badge">
      <TrophyIcon className="text-warning" aria-hidden />
      {count}x streak
    </Badge>
  );
}

/** "3s head start": the challenger draws alone this long first. */
export function HeadStartBadge({ seconds, className }: { seconds: number; className?: string }) {
  return (
    <Badge variant="outline" className={cn(look, className)}>
      <TimerIcon className="text-warning" aria-hidden />
      {seconds}s head start
    </Badge>
  );
}

/**
 * The badge by a team's drawer for the round the view is about (section 7): the streak by
 * the staying drawer, the head start by the other team's challenger; null when there's none.
 * Badges only, no labels (SB15).
 */
export function drawerBadge(view: SketchBattleView, team: TeamIndex): ReactNode {
  const streak = view.streak;
  if (!streak) return null;
  if (streak.team === team) {
    return streak.count >= STREAK_BADGE_MIN_WINS ? <StreakBadge count={streak.count} /> : null;
  }
  return view.headStartSeconds > 0 ? <HeadStartBadge seconds={view.headStartSeconds} /> : null;
}
