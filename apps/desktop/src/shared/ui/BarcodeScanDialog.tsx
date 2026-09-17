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
import { useLocalization } from "@app/providers/LocalizationProvider";

export function BarcodeScanDialog() {
  const { activeSession, cancelScan, submitScan } = useBarcodeScanner();
  const { direction, t } = useLocalization();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (activeSession) {
      setValue("");
    }
  }, [activeSession]);

  if (!activeSession) return null;

  return (
    <Dialog open={!!activeSession} onOpenChange={(open) => (!open ? cancelScan() : undefined)}>
      <DialogContent className="max-w-md" dir={direction}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            {t("barcodeScan.title", { namespace: "common" })}
          </DialogTitle>
          <DialogDescription>
            {t("barcodeScan.description", {
              namespace: "common",
              vars: { field: activeSession.label },
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t("barcodeScan.placeholder", { namespace: "common" })}
            dir="ltr"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={cancelScan}>
              {t("actions.cancel", { namespace: "common" })}
            </Button>
            <Button
              type="button"
              onClick={() => {
                submitScan(value.trim());
                setValue("");
              }}
              disabled={!value.trim()}
            >
              {t("actions.confirm", { namespace: "common" })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
