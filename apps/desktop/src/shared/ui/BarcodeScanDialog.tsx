import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { useBarcodeScanner } from "@app/providers/BarcodeScannerProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";

export function BarcodeScanDialog() {
  const { activeSession, cancelScan, submitScan } = useBarcodeScanner();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (activeSession) {
      setValue("");
    }
  }, [activeSession]);

  if (!activeSession) return null;

  return (
    <Dialog open={!!activeSession} onOpenChange={(open) => (!open ? cancelScan() : undefined)}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-blue-600" />
            مسح الباركود
          </DialogTitle>
          <DialogDescription>
            أدخل أو امسح قيمة الباركود للحقل: {activeSession.label}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="أدخل قيمة الباركود أو استخدم الماسح"
            dir="ltr"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={cancelScan}>
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={() => {
                submitScan(value.trim());
                setValue("");
              }}
              disabled={!value.trim()}
            >
              اعتماد
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
