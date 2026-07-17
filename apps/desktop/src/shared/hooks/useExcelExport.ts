import { useCallback } from "react";
import { saveExcelFile } from "@shared/lib/excel";
import type { ExcelExportColumn, ExcelExportOptions } from "@shared/lib/excel";
import { toast } from "sonner";

export function useExcelExport() {
  const exportData = useCallback(
    async (
      data: Record<string, unknown>[],
      columns: ExcelExportColumn[],
      filename: string,
      options?: ExcelExportOptions,
    ): Promise<boolean> => {
      if (data.length === 0) {
        toast.error("لا توجد بيانات لتصديرها");
        return false;
      }
      const ok = await saveExcelFile(data, columns, filename, options);
      if (ok) toast.success("تم حفظ ملف Excel بنجاح");
      return ok;
    },
    [],
  );

  return { exportData };
}
