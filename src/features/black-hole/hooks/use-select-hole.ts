import { DEFAULT_PRESET_ID } from "@/features/black-hole/lib/holes/routes";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { pathForHole, resolveHole } from "@/features/black-hole/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export function useSelectHole() {
  const router = useRouter();
  const pathname = usePathname();
  return (presetId: string) => {
    useBlackHole.getState().applyPreset(presetId);
    const path = pathForHole(resolveHole(presetId) ?? DEFAULT_PRESET_ID);
    if (pathname !== path) router.push(path, { scroll: false });
  };
}
