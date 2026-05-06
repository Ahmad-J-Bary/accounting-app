import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import type { ConsumableDto } from "@erp/shared-types";

interface IssueConsumableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consumable: ConsumableDto | null;
  onConfirm: (quantity: string, description: string) => Promise<void>;
  isSubmitting: boolean;
}

export function IssueConsumableDialog({ open, onOpenChange, consumable, onConfirm, isSubmitting }: IssueConsumableDialogProps) {
  const [data, setData] = useState({ quantity: "1", description: "صرف دوري" });

  useEffect(() => {
    if (open) setData({ quantity: "1", description: "صرف دوري" });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>صرف مواد: {consumable?.name}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label>الكمية</Label><Input type="number" value={data.quantity} onChange={e => setData({...data, quantity: e.target.value})} /></div>
          <div className="space-y-2"><Label>البيان</Label><Input value={data.description} onChange={e => setData({...data, description: e.target.value})} /></div>
        </div>
        <DialogFooter><Button onClick={() => onConfirm(data.quantity, data.description)} disabled={isSubmitting}>{isSubmitting ? "جاري المعالجة..." : "تأكيد"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
