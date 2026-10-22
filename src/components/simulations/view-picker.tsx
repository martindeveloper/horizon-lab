"use client";

import { useState, type ReactNode } from "react";

import { ListItem, Picker, cn, kickerClass } from "@horizon/toolkit/ui";

export type ViewListProps<Id extends string> = {
  ids: readonly Id[];
  selected: (id: Id) => boolean;
  labelOf: (id: Id) => string;
  /** A line under the name: what the view shows. */
  hintOf?: ((id: Id) => string) | undefined;
  /** A word beside the name: the view's kind. */
  kickerOf?: ((id: Id) => string) | undefined;
  onPick: (id: Id) => void;
  /** After the views: a way on, such as the Orrery's link into Deep Field. */
  children?: ReactNode;
};

/**
 * A simulation's views (or presets) as a list, one row each: the name, its hint under it and
 * its kicker beside it, where the simulation words them. With a kicker the name and hint
 * truncate so the kicker keeps its place; without one they wrap.
 */
export function ViewList<Id extends string>({
  ids,
  selected,
  labelOf,
  hintOf,
  kickerOf,
  onPick,
  children,
}: ViewListProps<Id>) {
  return (
    <div className="flex flex-col gap-1">
      {ids.map((id) =>
        kickerOf ? (
          <ListItem key={id} selected={selected(id)} onClick={() => onPick(id)}>
            {hintOf ? (
              <span className="min-w-0">
                <span className="block truncate">{labelOf(id)}</span>
                <span className="block truncate text-xs text-muted">{hintOf(id)}</span>
              </span>
            ) : (
              <span>{labelOf(id)}</span>
            )}
            <span className={cn(kickerClass, hintOf && "shrink-0")}>{kickerOf(id)}</span>
          </ListItem>
        ) : (
          <ListItem
            key={id}
            selected={selected(id)}
            onClick={() => onPick(id)}
            className="flex-col items-start justify-start gap-0"
          >
            <span>{labelOf(id)}</span>
            {hintOf ? <span className="text-xs text-muted">{hintOf(id)}</span> : null}
          </ListItem>
        ),
      )}
      {children}
    </div>
  );
}

/** The current view as a pill that opens the list; picking one closes it. A tour rings it as `views`. */
export function ViewPicker<Id extends string>({
  ariaLabel,
  label,
  detail,
  className,
  triggerClassName,
  onPick,
  ...list
}: ViewListProps<Id> & {
  ariaLabel: string;
  label: string;
  detail?: string | undefined;
  className?: string | undefined;
  triggerClassName?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Picker
      data-coach="views"
      aria-label={ariaLabel}
      label={label}
      open={open}
      onOpenChange={setOpen}
      {...(detail === undefined ? {} : { detail })}
      {...(className === undefined ? {} : { className })}
      {...(triggerClassName === undefined ? {} : { triggerClassName })}
    >
      <ViewList
        {...list}
        onPick={(id) => {
          setOpen(false);
          onPick(id);
        }}
      />
    </Picker>
  );
}
