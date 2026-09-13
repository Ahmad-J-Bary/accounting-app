import { useCallback } from "react";
import { useLocalization } from "@/app/providers/LocalizationProvider";

export interface NavLabelSource {
  id: string;
  defaultLabel: string;
  customLabel?: string;
  isCustom?: boolean;
}

export interface NavGroupLabelSource {
  id: string;
  defaultTitle: string;
  customTitle?: string;
  isCustom?: boolean;
}

export function useNavLabels() {
  const { t } = useLocalization();

  const itemLabel = useCallback(
    (item: NavLabelSource): string => {
      if (item.customLabel) return item.customLabel;
      if (!item.isCustom) {
        return t(`nav.${item.id}`, { namespace: "shell"});
      }
      return item.defaultLabel;
    },
    [t],
  );

  const groupTitle = useCallback(
    (group: NavGroupLabelSource): string => {
      if (group.customTitle) return group.customTitle;
      if (!group.isCustom) {
        return t(`nav.groups.${group.id}`, { namespace: "shell"});
      }
      return group.defaultTitle;
    },
    [t],
  );

  const routeLabel = useCallback(
    (id: string, fallback?: string) => t(`nav.${id}`, { namespace: "shell", fallback }),
    [t],
  );

  return { itemLabel, groupTitle, routeLabel };
}