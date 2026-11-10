import type { ReactNode } from "react";

interface ShellProps {
  children: ReactNode;
  headerRight?: ReactNode;
  bottomBar?: ReactNode;
}

export function Shell({ children, headerRight, bottomBar }: ShellProps) {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <a href="/" className="text-xl font-bold tracking-tight">
          PlayDen
        </a>
        {headerRight}
      </header>
      <main className="flex-1 overflow-y-auto px-4">{children}</main>
      {bottomBar && (
        <footer className="border-t border-white/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {bottomBar}
        </footer>
      )}
    </div>
  );
}
