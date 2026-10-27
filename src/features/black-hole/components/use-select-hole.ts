import { usePathname, useRouter } from "@/i18n/navigation";

import { DEFAULT_PRESET_ID } from "../lib/holes/routes";
import { useBlackHole } from "../lib/store";
import { pathForHole, resolveHole } from "../routing";

export function useSelectHole() {
  const router = useRouter();
  const pathname = usePathname();
  return (presetId: string) => {
    useBlackHole.getState().applyPreset(presetId);
    const path = pathForHole(resolveHole(presetId) ?? DEFAULT_PRESET_ID);
    if (pathname !== path) router.push(path, { scroll: false });
  };
}
