import { Button } from "@playden/ui/components/button";
import { ThemeToggle } from "@playden/ui/components/theme-toggle";
import { ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { navigate } from "./router";

interface ShellProps {
  children: ReactNode;
  /** Shows a back arrow to the lobby instead of the logo link. */
  back?: boolean;
  /** Replaces the plain theme switch on the right, e.g. the account menu. */
  headerRight?: ReactNode;
}

export function Shell({ children, back = false, headerRight }: ShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-1 px-2">
          {back ? (
            <Button
              variant="ghost"
              className="h-11 gap-1 px-2 text-base"
              onClick={() => navigate("/")}
            >
              <ChevronLeftIcon className="size-5" />
              Lobby
            </Button>
          ) : (
            <a href="/" className="flex h-11 items-center gap-2 px-2">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
              >
                P
              </span>
              <span className="text-lg font-semibold tracking-tight">PlayDen</span>
            </a>
          )}
          <div className="ml-auto flex items-center">{headerRight ?? <ThemeToggle />}</div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4">{children}</main>
    </div>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center pb-16">{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pt-4 pb-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto flex gap-2 bg-gradient-to-t from-background from-70% to-transparent pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}
