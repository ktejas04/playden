import { ROOM_CODE_LENGTH } from "@playden/protocol";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@playden/ui/components/input-otp";
import { cleanJoinInput } from "../room/joinCode";

const SLOTS = Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => index);

interface JoinCodeInputProps {
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
}

/** Four letter tiles. Typing fills them; pasting a room link fills them with its code. */
export function JoinCodeInput({ value, onChange, invalid }: JoinCodeInputProps) {
  return (
    <InputOTP
      id="joinCode"
      maxLength={ROOM_CODE_LENGTH}
      value={value}
      onChange={(next) => onChange(cleanJoinInput(next))}
      pasteTransformer={cleanJoinInput}
      pattern="^[A-Za-z]+$"
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      aria-invalid={invalid ? true : undefined}
      containerClassName="w-full"
    >
      <InputOTPGroup className="w-full justify-between gap-2">
        {SLOTS.map((index) => (
          <InputOTPSlot
            key={index}
            index={index}
            aria-invalid={invalid ? true : undefined}
            className="h-16 flex-1 rounded-xl! border-2! border-dashed bg-transparent! font-heading text-3xl font-bold text-tile-foreground uppercase transition-[background-color,border-color,box-shadow] duration-150 data-[active=true]:border-solid data-[active=true]:border-ring data-[active=true]:ring-ring/30 data-[filled=true]:border-solid data-[filled=true]:border-transparent! data-[filled=true]:bg-tile! data-[filled=true]:shadow-[0_3px_0_0_var(--tile-edge)]"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
