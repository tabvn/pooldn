"use client";

import { useCallback, useId } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";

/**
 * Round-12 TASK 0.2 — the wizard's Structure builder.
 *
 * Items in the ordered list are one of four kinds: SINGLES, DOUBLES,
 * SCOTCH_DOUBLES, or BREAK. Each item can be reordered via dnd-kit; "Add
 * Singles / Doubles / Scotch / Break" buttons append the corresponding row.
 *
 * The wizard form persists this as an array of `StructureItem`. On submit
 * the wizard collapses adjacent BREAK rows into the preceding game block's
 * `breakAfterMin` field so the existing MatchFormatBlock schema doesn't need
 * a new enum value. A trailing BREAK is dropped (no block to attach to).
 */
export type StructureItem =
  | {
      uid: string;
      kind: "GAME";
      type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES";
      games: number;
      raceTo?: number | null;
    }
  | { uid: string; kind: "BREAK"; durationMin: number };

export function StructureBuilder({
  items,
  onChange,
  totalGames,
}: {
  items: StructureItem[];
  onChange: (next: StructureItem[]) => void;
  totalGames: number;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      if (!e.over || e.active.id === e.over.id) return;
      const from = items.findIndex((it) => it.uid === e.active.id);
      const to = items.findIndex((it) => it.uid === e.over!.id);
      if (from < 0 || to < 0) return;
      onChange(arrayMove(items, from, to));
    },
    [items, onChange],
  );

  function addGame(type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES") {
    onChange([
      ...items,
      { uid: rid(), kind: "GAME", type, games: 1 },
    ]);
  }
  function addBreak() {
    onChange([...items, { uid: rid(), kind: "BREAK", durationMin: 10 }]);
  }
  function remove(uid: string) {
    onChange(items.filter((it) => it.uid !== uid));
  }
  function update(uid: string, patch: Partial<StructureItem>) {
    onChange(
      items.map((it) =>
        it.uid === uid ? ({ ...it, ...patch } as StructureItem) : it,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold">Match structure</h2>
          <p className="text-sm text-muted-foreground">
            Drag to reorder. Add singles, doubles, scotch, or a break — they
            run in the order shown.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {totalGames} game{totalGames === 1 ? "" : "s"} total
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((it) => it.uid)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="space-y-2" data-testid="structure-builder-list">
            {items.map((item, i) => (
              <Row
                key={item.uid}
                index={i}
                item={item}
                onChange={(patch) => update(item.uid, patch)}
                onRemove={() => remove(item.uid)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap gap-2">
        <AddButton onClick={() => addGame("SINGLES")}>+ Add Singles</AddButton>
        <AddButton onClick={() => addGame("DOUBLES")}>+ Add Doubles</AddButton>
        <AddButton onClick={() => addGame("SCOTCH_DOUBLES")}>
          + Add Scotch
        </AddButton>
        <AddButton onClick={addBreak} tone="break">
          + Add Break
        </AddButton>
      </div>
    </div>
  );
}

function Row({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: StructureItem;
  index: number;
  onChange: (patch: Partial<StructureItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.uid });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const labelId = useId();

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={
        item.kind === "BREAK"
          ? `structure-break-${index}`
          : `structure-game-${index}`
      }
      className={
        "rounded-xl border bg-card px-3 py-3 " +
        (item.kind === "BREAK"
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border")
      }
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab rounded-md p-1 text-muted-foreground hover:bg-secondary/40 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground w-12 shrink-0">
          #{index + 1}
        </span>

        {item.kind === "BREAK" ? (
          <>
            <span
              className="text-sm font-semibold text-amber-300"
              id={labelId}
            >
              Break
            </span>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              Duration
              <input
                type="number"
                min={1}
                value={item.durationMin}
                onChange={(e) =>
                  onChange({ durationMin: Number(e.target.value) || 0 })
                }
                className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
                aria-labelledby={labelId}
              />
              <span>min</span>
            </label>
          </>
        ) : (
          <>
            <select
              value={item.type}
              onChange={(e) =>
                onChange({ type: e.target.value as typeof item.type })
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Block type"
            >
              <option value="SINGLES">Singles</option>
              <option value="DOUBLES">Doubles</option>
              <option value="SCOTCH_DOUBLES">Scotch Doubles</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Games
              <input
                type="number"
                min={1}
                value={item.games}
                onChange={(e) =>
                  onChange({ games: Number(e.target.value) || 1 })
                }
                className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Race to
              <input
                type="number"
                min={1}
                value={item.raceTo ?? ""}
                placeholder="—"
                onChange={(e) =>
                  onChange({
                    raceTo: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
          </>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove item"
          className="ml-auto rounded-md border border-destructive/30 bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function AddButton({
  onClick,
  children,
  tone,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "break";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors " +
        (tone === "break"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          : "border-dashed border-border hover:bg-secondary/40")
      }
    >
      {children}
    </button>
  );
}

function rid() {
  // simple non-cryptographic uid for client-only list keys
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Collapse a UI item list into the persisted block representation:
 * each GAME becomes a MatchFormatBlock; a BREAK that *follows* a GAME
 * attaches its duration as that game's `breakAfterMin`. Trailing BREAK
 * rows are dropped (no block to attach to).
 */
export function structureItemsToBlocks(items: StructureItem[]): Array<{
  type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES";
  games: number;
  raceTo: number | null;
  breakAfterMin: number | null;
}> {
  const out: Array<{
    type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES";
    games: number;
    raceTo: number | null;
    breakAfterMin: number | null;
  }> = [];
  for (const it of items) {
    if (it.kind === "GAME") {
      out.push({
        type: it.type,
        games: Math.max(1, Number(it.games) || 1),
        raceTo: it.raceTo ?? null,
        breakAfterMin: null,
      });
    } else if (out.length > 0) {
      out[out.length - 1]!.breakAfterMin = Math.max(0, it.durationMin) || null;
    }
  }
  return out;
}

/**
 * Reverse direction — used by the edit wizard to seed the builder from
 * existing MatchFormatBlock rows. A non-null `breakAfterMin` on a game block
 * is expanded into a separate BREAK item after the corresponding game.
 */
export function blocksToStructureItems(
  blocks: Array<{
    type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES";
    games: number;
    raceTo?: number | null;
    breakAfterMin?: number | null;
  }>,
): StructureItem[] {
  const out: StructureItem[] = [];
  for (const b of blocks) {
    out.push({
      uid: rid(),
      kind: "GAME",
      type: b.type,
      games: b.games,
      raceTo: b.raceTo ?? null,
    });
    if (b.breakAfterMin && b.breakAfterMin > 0) {
      out.push({ uid: rid(), kind: "BREAK", durationMin: b.breakAfterMin });
    }
  }
  return out;
}
