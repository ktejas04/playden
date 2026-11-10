import type { Me } from "@playden/protocol";
import { Badge } from "@playden/ui/components/badge";
import { Button } from "@playden/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@playden/ui/components/dropdown-menu";
import { LogOutIcon, MonitorIcon, MoonIcon, ShieldCheckIcon, SunIcon } from "lucide-react";
import { useTheme } from "@playden/ui/components/theme-provider";
import { PlayerAvatar } from "./components/PlayerAvatar";

interface AccountMenuProps {
  me: Me;
  /** People waiting for approval; shown to admins as a badge. */
  waiting: number;
  onOpenMembers: () => void;
  onSignOut: () => void;
}

export function AccountMenu({ me, waiting, onOpenMembers, onSignOut }: AccountMenuProps) {
  const { theme = "system", setTheme } = useTheme();
  const name = me.displayName ?? me.email;
  const showWaiting = me.isAdmin && waiting > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="relative rounded-full p-0 hover:bg-transparent hover:ring-2 hover:ring-primary/60 data-[state=open]:ring-2 data-[state=open]:ring-primary"
          aria-label={showWaiting ? `Account menu, ${waiting} waiting to join` : "Account menu"}
        >
          <PlayerAvatar id={me.id} name={name} size="lg" />
          {showWaiting && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 border-2 border-background px-1 tabular-nums">
              {waiting}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{me.email}</span>
        </DropdownMenuLabel>
        {me.isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="h-10" onSelect={onOpenMembers}>
              <ShieldCheckIcon /> Members
              {showWaiting && (
                <Badge className="ml-auto tabular-nums" aria-label={`${waiting} waiting`}>
                  {waiting}
                </Badge>
              )}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem className="h-10" value="light">
            <SunIcon /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="h-10" value="dark">
            <MoonIcon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="h-10" value="system">
            <MonitorIcon /> Phone setting
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="h-10" variant="destructive" onSelect={onSignOut}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
