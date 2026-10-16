import { useBlackHole } from "@/features/black-hole/lib/store";
import { pathForHole } from "@/features/black-hole/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export function useSelectHole() {
  const router = useRouter();
  const pathname = usePathname();
  return (presetId: string) => {
    useBlackHole.getState().applyPreset(presetId);
    const path = pathForHole(presetId);
    if (pathname !== path) router.push(path, { scroll: false });
  };
}
