import { Button } from "@playden/ui/components/button";
import { Input } from "@playden/ui/components/input";
import { CheckIcon, SendHorizontalIcon } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { GUESS_WINDOW_MS, MAX_GUESS_LENGTH } from "../config";
import { guessProblem, rememberGuess, tooManyGuesses } from "../guess";

/**
 * The guess box (S6): at most 36 characters, no pasting, at most 3 guesses in any 3 s (the
 * button waits instead of sending), open only while drawing, locked once the team has it.
 * The server checks all of it again.
 */
export function GuessBox({
  open,
  solved,
  now,
  onGuess,
}: {
  open: boolean;
  solved: boolean;
  now: () => number;
  onGuess: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const [, wake] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const waiting = tooManyGuesses(recent, now());

  // Re-enable the button when the oldest of the last 3 guesses leaves the 3 s window.
  useEffect(() => {
    if (!waiting) return;
    const oldest = recent[0] ?? now();
    const timer = setTimeout(() => wake((n) => n + 1), oldest + GUESS_WINDOW_MS - now() + 10);
    return () => clearTimeout(timer);
  }, [waiting, recent, now]);

  if (solved) {
    return (
      <p className="flex h-12 items-center justify-center gap-2 rounded-xl bg-success/15 font-heading text-lg font-bold text-success duration-300 animate-in fade-in-0 zoom-in-95">
        <CheckIcon className="size-5" /> You got it!
      </p>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const issue = guessProblem(text);
    if (issue) return setProblem(issue);
    if (tooManyGuesses(recent, now())) return setProblem("Slow down");
    onGuess(text.trim());
    setRecent((times) => rememberGuess(times, now()));
    setText("");
    setProblem(null);
    input.current?.focus();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1" data-tour="guess-box">
      <div className="flex gap-2">
        <Input
          ref={input}
          value={text}
          maxLength={MAX_GUESS_LENGTH}
          disabled={!open}
          placeholder={open ? "Type your guess" : "Get ready to guess"}
          aria-label="Your guess"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          className="h-12 rounded-xl bg-card text-base"
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
        />
        <Button
          type="submit"
          size="icon-lg"
          className="size-12"
          aria-label="Send guess"
          disabled={!open || waiting || text.trim().length === 0}
        >
          <SendHorizontalIcon className="size-5" />
        </Button>
      </div>
      {(problem || waiting) && (
        <p className="px-1 text-sm text-muted-foreground" role="status">
          {waiting ? "Slow down" : problem}
        </p>
      )}
    </form>
  );
}
