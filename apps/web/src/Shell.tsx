import type { ReactNode } from "react";
import { ThemeToggle } from "@playden/ui/components/theme-toggle";

interface ShellProps {
  children: ReactNode;
  headerRight?: ReactNode;
  bottomBar?: ReactNode;
}

export function Shell({ children, headerRight, bottomBar }: ShellProps) {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between gap-2 px-4 py-2">
        <a href="/" className="text-xl font-bold tracking-tight">
          PlayDen
        </a>
        <div className="flex items-center gap-1">
          {headerRight}
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 pb-4">{children}</main>
      {bottomBar && (
        <footer className="border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {bottomBar}
        </footer>
      )}
    </div>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full items-center justify-center py-8">{children}</div>;
}
