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
  AlertDialogTrigger,
} from "@playden/ui/components/alert-dialog";
import { Avatar, AvatarFallback } from "@playden/ui/components/avatar";
import { Badge } from "@playden/ui/components/badge";
import { Button } from "@playden/ui/components/button";
import { Card } from "@playden/ui/components/card";
import { toast } from "@playden/ui/components/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@playden/ui/components/tabs";
import { UserXIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { approveUser, banUser, listUsers } from "../api";
import { initials } from "../initials";
import { PageTitle } from "../Shell";

const TABS: { status: AccountStatus; label: string; empty: string }[] = [
  { status: "pending", label: "Waiting", empty: "Nobody is waiting. New sign-ups show up here." },
  { status: "approved", label: "Members", empty: "No members yet." },
  { status: "banned", label: "Banned", empty: "Nobody is banned." },
];

export function Admin() {
  const [tab, setTab] = useState<AccountStatus>("pending");

  return (
    <div className="pb-8">
      <PageTitle title="Members" subtitle="Let new people in, or remove access." />
      <Tabs className="mt-4" value={tab} onValueChange={(value) => setTab(value as AccountStatus)}>
        <TabsList className="w-full group-data-horizontal/tabs:h-11">
          {TABS.map((t) => (
            <TabsTrigger key={t.status} value={t.status} className="text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.status} value={t.status} className="pt-2">
            {tab === t.status && <UserList status={t.status} empty={t.empty} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function UserList({ status, empty }: { status: AccountStatus; empty: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      await load();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Something went wrong");
    }
  }

  if (error) return <p className="py-6 text-center text-destructive">{error}</p>;
  if (!users) return <p className="py-6 text-center text-muted-foreground">Loading…</p>;
  if (users.length === 0) return <p className="py-6 text-center text-muted-foreground">{empty}</p>;

  return (
    <ul className="flex flex-col gap-2">
      {users.map((user) => {
        const name = user.displayName ?? "No name yet";
        return (
          <li key={user.id}>
            <Card className="flex-row items-center gap-3 px-4 py-3">
              <Avatar size="lg">
                <AvatarFallback className="bg-primary/15 text-primary">
                  {initials(user.displayName ?? user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{name}</span>
                  {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                {user.invitedBy && (
                  <p className="truncate text-xs text-muted-foreground">
                    Invited by {user.invitedBy}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {status !== "approved" && (
                  <Button
                    className="h-10"
                    variant={status === "banned" ? "outline" : "default"}
                    onClick={() => void act(() => approveUser(user.id), `${name} can play now`)}
                  >
                    {status === "banned" ? "Let in" : "Approve"}
                  </Button>
                )}
                {status !== "banned" && !user.isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="size-10 text-muted-foreground hover:text-destructive"
                        aria-label={`Ban ${name}`}
                      >
                        <UserXIcon />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Ban {name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          They're signed out and can't create or join rooms. You can let them back
                          in later from the Banned tab.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => void act(() => banUser(user.id), `${name} is banned`)}
                        >
                          Ban
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
