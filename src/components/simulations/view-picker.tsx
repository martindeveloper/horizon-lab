"use client";

import { useState, type ReactNode } from "react";

import { ListHeading, ListItem, ListTrack, Picker } from "@horizon/toolkit/ui";

export type ViewListProps<Id extends string> = {
  ids: readonly Id[];
  selected: (id: Id) => boolean;
  labelOf: (id: Id) => string;
  /** A line or two under the name: what the view shows. */
  hintOf?: ((id: Id) => string) | undefined;
  /** The view's mark, before its name: the lab's own glyph for it. */
  iconOf?: ((id: Id) => ReactNode) | undefined;
  /** A short mono figure or tag after the name: the view's kind, scale or measure. */
  detailOf?: ((id: Id) => ReactNode) | undefined;
  /** The views are a sequence (a zoom out, a course): drawn as a route through their marks. */
  route?: boolean;
  /** Names the list over its rows, with their count, where a picker holds more than one. */
  title?: string | undefined;
  onPick: (id: Id) => void;
  /** After the views: a way on, such as the Orrery's link into Deep Field. */
  children?: ReactNode;
};

/**
 * A simulation's views (or presets) as a list, every lab's rows alike: its mark, the name with
 * its hint under it (two lines at most), and its detail at the end.
 */
export function ViewList<Id extends string>({
  ids,
  selected,
  labelOf,
  hintOf,
  iconOf,
  detailOf,
  route = false,
  title,
  onPick,
  children,
}: ViewListProps<Id>) {
  const rows = ids.map((id) => (
    <ListItem
      key={id}
      selected={selected(id)}
      icon={iconOf?.(id)}
      detail={detailOf?.(id)}
      onClick={() => onPick(id)}
    >
      <span className="block min-w-0 flex-1">
        <span className="block truncate">{labelOf(id)}</span>
        {hintOf ? (
          <span className="mt-0.5 line-clamp-2 block text-ui whitespace-normal text-fg-secondary">
            {hintOf(id)}
          </span>
        ) : null}
      </span>
    </ListItem>
  ));
  return (
    <div className="flex flex-col gap-1">
      {title ? (
        <ListHeading count={ids.length} className="px-3 pt-2 pb-1">
          {title}
        </ListHeading>
      ) : null}
      {route ? <ListTrack>{rows}</ListTrack> : <div className="grid gap-0.5">{rows}</div>}
      {children}
    </div>
  );
}

export type ViewPickerShellProps = {
  ariaLabel: string;
  /** The current view, as its row names, marks and measures it. */
  label: string;
  icon?: ReactNode;
  detail?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

/**
 * The view pill every lab puts first in its header (`HeaderRow`): the current view opening its
 * list below, as wide as the screen allows on phones. It gives way to the tools down to its
 * minimum width. A tour rings it as `views`.
 */
export function ViewPickerShell({
  ariaLabel,
  label,
  icon,
  detail,
  open,
  onOpenChange,
  children,
}: ViewPickerShellProps) {
  return (
    <Picker
      data-coach="views"
      aria-label={ariaLabel}
      label={label}
      icon={icon}
      detail={detail}
      open={open}
      onOpenChange={onOpenChange}
      className="min-w-36 flex-1"
      triggerClassName="relative max-w-[min(18rem,100%)] not-md:h-10 not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-0.5"
      panelClassName="w-[22rem] max-w-[calc(100vw-2*var(--hud-gutter,1rem))] p-2"
    >
      {children}
    </Picker>
  );
}

/** A lab's views in the shared pill: picking one closes the list. */
export function ViewPicker<Id extends string>({
  ariaLabel,
  label,
  icon,
  detail,
  onPick,
  ...list
}: ViewListProps<Id> & Pick<ViewPickerShellProps, "ariaLabel" | "label" | "icon" | "detail">) {
  const [open, setOpen] = useState(false);
  return (
    <ViewPickerShell
      ariaLabel={ariaLabel}
      label={label}
      icon={icon}
      detail={detail}
      open={open}
      onOpenChange={setOpen}
    >
      <ViewList
        {...list}
        onPick={(id) => {
          setOpen(false);
          onPick(id);
        }}
      />
    </ViewPickerShell>
  );
}

/**
 * A lab's header row: the view pill, then the toolbar at the far end. Phones too narrow for both
 * take the tools a row lower.
 */
export function HeaderRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{children}</div>;
}
