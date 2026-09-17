import { useCallback } from "react";
import { saveExcelFile } from "@shared/lib/excel";
import type { ExcelExportColumn, ExcelExportOptions } from "@shared/lib/excel";
import { toast } from "sonner";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function useExcelExport() {
  const { t } = useLocalization();
  const exportData = useCallback(
    async (
      data: Record<string, unknown>[],
      columns: ExcelExportColumn[],
      filename: string,
      options?: ExcelExportOptions,
    ): Promise<boolean> => {
      if (data.length === 0) {
        toast.error(t("toasts.noDataToExport", { namespace: "common" }));
        return false;
      }
      const ok = await saveExcelFile(data, columns, filename, options);
      if (ok) toast.success(t("toasts.excelSaved", { namespace: "common" }));
      return ok;
    },
    [t],
  );

  return { exportData };
}
