import { Button } from "@playden/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@playden/ui/components/card";
import { Centered } from "../Shell";

export function SignIn() {
  return (
    <Centered>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to PlayDen</CardTitle>
          <CardDescription>
            Game nights for our community. Sign in to create or join a room.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="h-11 w-full">
            <a href="/auth/login">Continue with Google</a>
          </Button>
        </CardContent>
      </Card>
    </Centered>
  );
}
