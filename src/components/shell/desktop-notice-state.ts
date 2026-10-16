import { flag, storageCell } from "@horizon/toolkit/storage";

// Session only: a reload keeps the notice dismissed, a new visit may show it again.
const notice = storageCell({ key: "horizon:desktop-notice", codec: flag() });

/**
 * Phones only: a coarse primary pointer on the toolkit's touch layout (narrower
 * than 48rem or shorter than 30rem, the inverse of its `md`). Landscape phones
 * count; tablets and narrow desktop windows do not.
 */
export const PHONE_QUERY =
  "(pointer: coarse) and (max-width: 47.98rem), (pointer: coarse) and (max-height: 29.98rem)";

export function noticeDismissed() {
  return notice.get() === true;
}

export function dismissNotice() {
  notice.set(true);
}

export function shouldShowNotice(isPhone: boolean) {
  return isPhone && !noticeDismissed();
}
