import type { AccountStatus, AdminUser } from "@playden/protocol";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@playden/ui/components/alert-dialog";
import { Button } from "@playden/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@playden/ui/components/dropdown-menu";
import { toast } from "@playden/ui/components/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@playden/ui/components/tabs";
import { BanIcon, MoreHorizontalIcon, UserXIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { approveUser, banUser, declineUser, listUsers, unblockUser } from "../api";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { PageTitle, Panel } from "../Shell";

const TABS: { status: AccountStatus; label: string; empty: string }[] = [
  { status: "pending", label: "Waiting", empty: "Nobody is waiting. New sign-ups appear here." },
  { status: "approved", label: "Members", empty: "No members yet." },
  { status: "banned", label: "Banned", empty: "Nobody is banned or blocked." },
];

export const MEMBERS_SUBTITLE = "Let new people in, or take access away.";

interface MembersProps {
  /** Runs after an admin changes someone's status, e.g. to refresh waiting counts. */
  onChanged?: () => void;
}

export function Admin({ onChanged }: MembersProps) {
  return (
    <div className="pb-10">
      <PageTitle title="Members" subtitle={MEMBERS_SUBTITLE} />
      <MembersManager className="mt-6" onChanged={onChanged} />
    </div>
  );
}

/** The member tabs on their own, so they can also open in a sheet over a room. */
export function MembersManager({ className, onChanged }: MembersProps & { className?: string }) {
  const [tab, setTab] = useState<AccountStatus>("pending");

  return (
    <Tabs
      className={className}
      value={tab}
      onValueChange={(value) => setTab(value as AccountStatus)}
    >
      <TabsList className="w-full group-data-horizontal/tabs:h-12 rounded-xl p-1">
        {TABS.map((t) => (
          <TabsTrigger key={t.status} value={t.status} className="rounded-lg font-heading text-sm">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.status} value={t.status} className="pt-3">
          {tab === t.status && <UserList status={t.status} empty={t.empty} onChanged={onChanged} />}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function UserList({
  status,
  empty,
  onChanged,
}: MembersProps & { status: AccountStatus; empty: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ user: AdminUser; kind: "ban" | "block" } | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers(status));
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't load members");
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: () => Promise<AdminUser>, done: string) {
    try {
      await action();
      toast.success(done);
      onChanged?.();
      await load();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Something went wrong");
    }
  }

  if (error) return <p className="py-8 text-center text-destructive">{error}</p>;
  if (!users) return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  if (users.length === 0) return <p className="py-8 text-center text-muted-foreground">{empty}</p>;

  const confirmName = confirm ? displayName(confirm.user) : "";

  return (
    <>
      <Panel className="px-4 py-1">
        <ul className="divide-y">
          {users.map((user) => {
            const name = displayName(user);
            return (
              <li key={user.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5">
                <PlayerAvatar id={user.id} name={user.displayName ?? user.email} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="truncate font-medium">{name}</span>
                    {user.isAdmin && <Tag tone="primary">Admin</Tag>}
                    {user.askedAgain && <Tag>Asked again</Tag>}
                    {status === "banned" && (
                      <Tag>{user.wasMember ? "Former member" : "Blocked request"}</Tag>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  {user.invitedBy && (
                    <p className="truncate text-xs text-muted-foreground">
                      Invited by {user.invitedBy}
                    </p>
                  )}
                </div>

                {status === "pending" && (
                  <div className="flex basis-full items-center gap-2 pl-[52px] sm:basis-auto sm:pl-0">
                    <Button
                      onClick={() => void act(() => approveUser(user.id), `${name} can play now`)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void act(
                          () => declineUser(user.id),
                          `Declined ${name}. They can ask again.`,
                        )
                      }
                    >
                      Decline
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`More for ${name}`}>
                          <MoreHorizontalIcon className="size-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-52">
                        <DropdownMenuItem
                          variant="destructive"
                          className="h-10"
                          onSelect={() => setConfirm({ user, kind: "block" })}
                        >
                          <BanIcon /> Block {name}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                {status === "approved" && !user.isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Ban ${name}`}
                    onClick={() => setConfirm({ user, kind: "ban" })}
                  >
                    <UserXIcon className="size-5" />
                  </Button>
                )}

                {status === "banned" &&
                  (user.wasMember ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void act(() => approveUser(user.id), `${name} is a member again`)
                      }
                    >
                      Let back in
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void act(() => unblockUser(user.id), `${name} is back in the waiting list`)
                      }
                    >
                      Unblock
                    </Button>
                  ))}
              </li>
            );
          })}
        </ul>
      </Panel>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "block" ? `Block ${confirmName}?` : `Ban ${confirmName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "block"
                ? "They can't ask to join again. Use this for spam or people nobody knows. You can unblock them from the Banned tab."
                : "They're signed out straight away and can't create or join rooms. You can let them back in from the Banned tab."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!confirm) return;
                const { user, kind } = confirm;
                void act(
                  () => banUser(user.id),
                  kind === "block" ? `${confirmName} is blocked` : `${confirmName} is banned`,
                );
              }}
            >
              {confirm?.kind === "block" ? "Block" : "Ban"} {confirmName}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function displayName(user: AdminUser): string {
  return user.displayName ?? "No name yet";
}

function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" }) {
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${
        tone === "primary" ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}
