"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/** A toolbar's geometry, CSS px: its padding across, the gap between buttons and a button's width. */
export type ToolbarPitch = { padding: number; gap: number; button: number };

/** How many buttons a toolbar of `pitch` holds in `room` px across. */
export const slotsIn = (room: number, { padding, gap, button }: ToolbarPitch) =>
  Math.max(0, Math.floor((room - padding + gap + 0.5) / (button + gap)));

/**
 * How many of a toolbar's `tools` it shows in `slots`: all while they fit, else as many as fit
 * beside the More button that holds the rest.
 */
export const toolsShown = (tools: number, slots: number) =>
  tools <= slots ? tools : Math.max(0, Math.min(tools, slots - 1));

const px = (value: string) => parseFloat(value) || 0;

/**
 * An item's narrowest width, CSS px: at min-content and without flexing, so an item that grows
 * into the row's free space (a view picker's column) counts only what it needs. The styles are
 * put back before anything paints.
 */
function narrowest(item: HTMLElement) {
  const { width, flex } = item.style;
  item.style.width = "min-content";
  item.style.flex = "none";
  const narrow = item.getBoundingClientRect().width;
  item.style.width = width;
  item.style.flex = flex;
  return narrow;
}

/** The width a toolbar may take on its line in `row`: the row less its other items there, at their narrowest, and their gaps. */
function roomFor(toolbar: HTMLElement, row: HTMLElement) {
  const style = getComputedStyle(row);
  const gap = px(style.columnGap);
  const line = toolbar.getBoundingClientRect();
  let room = row.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
  for (const child of row.children) {
    if (child === toolbar || !(child instanceof HTMLElement)) continue;
    const position = getComputedStyle(child).position;
    if (position === "absolute" || position === "fixed") continue;
    const box = child.getBoundingClientRect();
    if (box.width === 0 || box.bottom <= line.top || box.top >= line.bottom) continue;
    room -= narrowest(child) + gap;
  }
  return room;
}

/**
 * How many buttons `toolbar` has room for beside the other items on its line in its row,
 * measured before paint and again whenever the row or one of them resizes; unbounded until
 * measured. The row must not wrap, so the toolbar keeps its line.
 */
export function useToolbarSlots(toolbar: RefObject<HTMLElement | null>) {
  const [slots, setSlots] = useState(Infinity);
  useLayoutEffect(() => {
    const el = toolbar.current;
    const row = el?.parentElement;
    if (!el || !row) return;
    const measure = () => {
      const button = [...el.querySelectorAll<HTMLElement>(".icon-button")].find(
        (candidate) => candidate.offsetWidth > 0,
      );
      if (!button) return;
      const style = getComputedStyle(el);
      setSlots(
        slotsIn(roomFor(el, row), {
          padding: px(style.paddingLeft) + px(style.paddingRight),
          gap: px(style.columnGap),
          button: button.offsetWidth,
        }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const child of row.children) if (child !== el) observer.observe(child);
    measure();
    return () => observer.disconnect();
  }, [toolbar]);
  return slots;
}
