import { useCallback, useEffect, useMemo, useState } from "react";
import type { CompanySettings } from "@erp/shared-types";
import { settingsService } from "@modules/core/api/settingsService";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { useDesktopWindowState } from "./useDesktopWindowState";

interface UseWindowChromeDataOptions {
  windowTitle: string;
  brandLabelOverride?: string;
  companyLabelOverride?: string;
}

export function useWindowChromeData({
  windowTitle,
  brandLabelOverride,
  companyLabelOverride,
}: UseWindowChromeDataOptions) {
  const { t, direction } = useLocalization();
  const windowState = useDesktopWindowState();
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    if (companyLabelOverride) return;
    settingsService.getSettings().then(setCompanySettings).catch(() => {});
  }, [companyLabelOverride]);

  useEffect(() => {
    void windowState.setWindowTitle(windowTitle);
  }, [windowState, windowTitle]);

  const brandLabel = useMemo(
    () => brandLabelOverride || t("topbar.brandName", { namespace: "shell", fallback: "المواكب" }),
    [brandLabelOverride, t],
  );

  const companyLabel = useMemo(
    () =>
      companyLabelOverride ||
      companySettings?.company_name ||
      t("topbar.companyFallback", { namespace: "shell", fallback: "نظام المحاسبة والمخزون" }),
    [companyLabelOverride, companySettings?.company_name, t],
  );

  const handleTitleBarDoubleClick = useCallback(() => {
    if (!windowState.isTauriWindow) return;
    void windowState.toggleMaximize();
  }, [windowState]);

  return {
    direction,
    windowState,
    brandLabel,
    companyLabel,
    handleTitleBarDoubleClick,
  };
}
