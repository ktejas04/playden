import { Button } from "@playden/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@playden/ui/components/card";
import { Centered } from "../Shell";

export function Waiting({ onCheckAgain }: { onCheckAgain: () => void }) {
  return (
    <Centered>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">You're on the list</CardTitle>
          <CardDescription>
            An admin will let you in soon. You can play as soon as they approve you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="lg" className="h-11 w-full" onClick={onCheckAgain}>
            Check again
          </Button>
        </CardContent>
      </Card>
    </Centered>
  );
}
