import { Card, CardDescription, CardHeader, CardTitle } from "@playden/ui/components/card";
import { Centered } from "../Shell";

export function Banned() {
  return (
    <Centered>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Your access was removed</CardTitle>
          <CardDescription>Ask an admin if you think this is a mistake.</CardDescription>
        </CardHeader>
      </Card>
    </Centered>
  );
}
