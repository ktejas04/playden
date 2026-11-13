import { Button } from "@playden/ui/components/button";
import { ToggleGroup, ToggleGroupItem } from "@playden/ui/components/toggle-group";
import { cn } from "@playden/ui/lib/utils";
import { EraserIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { BrushSize, DrawStart, Tool } from "../types";
import { PALETTE, PALETTE_NAMES } from "./palette";

const SIZES: BrushSize[] = [1, 2, 3, 4];
/** Dot diameters for the size buttons, in pixels: a hint of each brush, not to scale. */
const DOT = { 1: 4, 2: 7, 3: 11, 4: 16 } as const;
/** Full-size touch targets on a phone. */
const ITEM = "h-10 min-w-10 rounded-xl";

/**
 * The drawer's tools (spec section 14): pen or eraser, 4 sizes and 10 colours, each a
 * single-choice toggle group, plus clear.
 */
export function Toolbar({
  tool,
  onChange,
  onClear,
}: {
  tool: DrawStart;
  onChange: (next: DrawStart) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2" data-tour="toolbar">
      <div className="flex items-center gap-1.5">
        <ToggleGroup
          type="single"
          spacing={1}
          aria-label="Tool"
          value={tool.tool}
          onValueChange={(value) => value && onChange({ ...tool, tool: value as Tool })}
        >
          <ToggleGroupItem value="pen" aria-label="Pen" className={ITEM} data-tour="pen">
            <PencilIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="eraser" aria-label="Eraser" className={ITEM} data-tour="eraser">
            <EraserIcon />
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          spacing={1}
          aria-label="Brush size"
          className="mx-1"
          data-tour="sizes"
          value={String(tool.size)}
          onValueChange={(value) =>
            value && onChange({ ...tool, size: Number(value) as BrushSize })
          }
        >
          {SIZES.map((size) => (
            <ToggleGroupItem
              key={size}
              value={String(size)}
              aria-label={`Size ${size}`}
              className={ITEM}
            >
              <span
                className="rounded-full bg-foreground"
                style={{ width: DOT[size], height: DOT[size] }}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          variant="outline"
          size="icon"
          className="ml-auto"
          aria-label="Clear the canvas"
          data-tour="clear"
          onClick={onClear}
        >
          <Trash2Icon />
        </Button>
      </div>
      <ToggleGroup
        type="single"
        spacing={1}
        aria-label="Colour"
        className="grid w-full grid-cols-10"
        data-tour="colours"
        value={String(tool.colour)}
        onValueChange={(value) =>
          value && onChange({ ...tool, tool: "pen", colour: Number(value) })
        }
      >
        {PALETTE.map((colour, index) => (
          <ToggleGroupItem
            key={colour}
            value={String(index)}
            aria-label={PALETTE_NAMES[index]}
            className={cn(
              "h-8 w-full min-w-0 rounded-lg border-2 border-black/10 p-0 transition-transform duration-150",
              "data-[state=on]:scale-110 data-[state=on]:border-foreground",
            )}
            style={{ background: colour }}
          />
        ))}
      </ToggleGroup>
    </div>
  );
}
