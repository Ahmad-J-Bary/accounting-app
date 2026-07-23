import { useCallback, useState } from "react";

export type ExportCurrencyMode = "fixed" | "variable";

const STORAGE_KEY = "erp_export_currency_mode";

function readMode(): ExportCurrencyMode {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "fixed" || raw === "variable") return raw;
  return "fixed";
}

export function useExportSettings() {
  const [currencyMode, setCurrencyModeState] = useState<ExportCurrencyMode>(readMode);

  const setCurrencyMode = useCallback((mode: ExportCurrencyMode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    setCurrencyModeState(mode);
  }, []);

  return { currencyMode, setCurrencyMode };
}
