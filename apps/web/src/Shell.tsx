import { Button } from "@playden/ui/components/button";
import { ThemeToggle } from "@playden/ui/components/theme-toggle";
import { ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { navigate } from "./router";

interface ShellProps {
  children: ReactNode;
  /** Shows "Lobby" with a back arrow instead of the wordmark. */
  back?: boolean;
  /** Replaces the plain theme switch on the right, e.g. the account menu. */
  headerRight?: ReactNode;
}

export function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={`rounded-full bg-primary shadow-[0_2px_0_0_var(--primary-edge)] ${large ? "size-6" : "size-4"}`}
      />
      <span className={`font-heading font-bold tracking-tight ${large ? "text-4xl" : "text-xl"}`}>
        PlayDen
      </span>
    </span>
  );
}

export function Shell({ children, back = false, headerRight }: ShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center gap-1 px-3">
          {back ? (
            <Button
              variant="ghost"
              className="h-11 gap-1 pr-3 pl-1.5 text-base"
              onClick={() => navigate("/")}
            >
              <ChevronLeftIcon className="size-5" />
              Lobby
            </Button>
          ) : (
            <a
              href="/"
              data-slot="logo"
              className="flex h-11 items-center rounded-xl px-1.5 transition-opacity hover:opacity-80"
            >
              <Wordmark />
            </a>
          )}
          <div className="ml-auto flex items-center">{headerRight ?? <ThemeToggle />}</div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 sm:px-5">{children}</main>
    </div>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col justify-center pb-20">{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pt-3 pb-1">
      <h1 className="text-[2rem] leading-tight font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 max-w-prose text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** A quiet surface for a group of content; lists inside it use dividers, not more cards. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border bg-card p-5 shadow-[0_2px_0_0_var(--border)] ${className}`}
    >
      {children}
    </section>
  );
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto flex gap-2 bg-gradient-to-t from-background from-65% to-transparent pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}
