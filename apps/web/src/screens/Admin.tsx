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
import { Badge } from "@playden/ui/components/badge";
import { Button } from "@playden/ui/components/button";
import { Card, CardContent } from "@playden/ui/components/card";
import { toast } from "@playden/ui/components/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@playden/ui/components/tabs";
import { useCallback, useEffect, useState } from "react";
import { approveUser, banUser, listUsers } from "../api";

const TABS: { status: AccountStatus; label: string; empty: string }[] = [
  { status: "pending", label: "Waiting", empty: "Nobody is waiting." },
  { status: "approved", label: "Members", empty: "No members yet." },
  { status: "banned", label: "Banned", empty: "Nobody is banned." },
];

export function Admin() {
  const [tab, setTab] = useState<AccountStatus>("pending");

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="text-2xl font-semibold">Members</h1>
      <Tabs value={tab} onValueChange={(value) => setTab(value as AccountStatus)}>
        <TabsList className="w-full">
          {TABS.map((t) => (
            <TabsTrigger key={t.status} value={t.status} className="h-9">
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

  if (error) return <p className="text-destructive">{error}</p>;
  if (!users) return <p className="text-muted-foreground">Loading…</p>;
  if (users.length === 0) return <p className="text-muted-foreground">{empty}</p>;

  return (
    <ul className="flex flex-col gap-2">
      {users.map((user) => {
        const name = user.displayName ?? "No name yet";
        return (
          <li key={user.id}>
            <Card size="sm">
              <CardContent className="flex flex-col gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{name}</span>
                    {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  {user.invitedBy && (
                    <p className="text-sm text-muted-foreground">Invited by {user.invitedBy}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {status !== "approved" && (
                    <Button
                      size="lg"
                      className="h-11 flex-1"
                      onClick={() => void act(() => approveUser(user.id), `${name} can play now`)}
                    >
                      {status === "banned" ? "Let back in" : "Approve"}
                    </Button>
                  )}
                  {status !== "banned" && !user.isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="lg" className="h-11 flex-1">
                          Ban
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ban {name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            They are signed out and can't create or join rooms. You can let them
                            back in later.
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
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
