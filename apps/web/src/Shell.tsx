import type { ReactNode } from "react";
import { ThemeToggle } from "@playden/ui/components/theme-toggle";

interface ShellProps {
  children: ReactNode;
  headerRight?: ReactNode;
}

export function Shell({ children, headerRight }: ShellProps) {
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
      <main className="flex flex-1 flex-col overflow-y-auto px-4">{children}</main>
    </div>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center py-8">{children}</div>;
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-auto flex gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}
