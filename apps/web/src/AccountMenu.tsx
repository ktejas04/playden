import type { Me } from "@playden/protocol";
import { Avatar, AvatarFallback } from "@playden/ui/components/avatar";
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
import { initials } from "./initials";
import { navigate } from "./router";

export function AccountMenu({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const { theme = "system", setTheme } = useTheme();
  const name = me.displayName ?? me.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-11 rounded-full p-0" aria-label="Account menu">
          <Avatar size="lg">
            <AvatarFallback className="bg-primary/15 font-medium text-primary">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
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
            <DropdownMenuItem className="h-10" onSelect={() => navigate("/admin")}>
              <ShieldCheckIcon /> Members
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
