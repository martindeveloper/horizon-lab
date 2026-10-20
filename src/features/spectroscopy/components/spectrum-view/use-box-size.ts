import { useEffect, useState, type RefObject } from "react";

/** The element's CSS width and the device pixel ratio, as they change. */
export function useBoxSize(box: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setWidth(el.clientWidth);
      setDpr(window.devicePixelRatio || 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [box]);
  return { width, dpr };
}
