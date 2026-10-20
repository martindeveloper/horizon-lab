import { flag, storageCell } from "@horizon/toolkit/storage";

// Session only: a reload keeps the notice dismissed, a new visit may show it again.
const notice = storageCell({ key: "desktop-notice", codec: flag() });

export function noticeDismissed() {
  return notice.get() === true;
}

export function dismissNotice() {
  notice.set(true);
}

export function shouldShowNotice(isPhone: boolean) {
  return isPhone && !noticeDismissed();
}
