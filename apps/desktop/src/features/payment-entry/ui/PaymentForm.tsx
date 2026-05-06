import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CreatePaymentRequest, CustomerDto, SupplierDto, PaymentType } from "@erp/shared-types";

import { PAYMENT_TYPE_LABELS } from "./constants";

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerDto[];
  suppliers: SupplierDto[];
  onSave: (payload: CreatePaymentRequest) => Promise<void>;
  saving: boolean;
}

export function PaymentForm({ open, onOpenChange, customers, suppliers, onSave, saving }: PaymentFormProps) {
  const [form, setForm] = useState<Partial<CreatePaymentRequest>>({
    payment_type: "Receipt",
    amount: 0,
    payment_date: new Date().toISOString(),
  });

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm({
        payment_type: "Receipt",
        amount: 0,
        payment_date: new Date().toISOString(),
      });
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    await onSave({
      payment_type: form.payment_type as PaymentType,
      amount: form.amount || 0,
      payment_date: form.payment_date || new Date().toISOString(),
      customer_id: form.customer_id || undefined,
      supplier_id: form.supplier_id || undefined,
      reference: form.reference || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة حركة نقدية</DialogTitle>
          <DialogDescription>تسجيل حركة قبض أو صرف نقدية جديدة في النظام.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>نوع الحركة</Label>
            <Select value={form.payment_type} onValueChange={v => setForm(p => ({ ...p, payment_type: v as CreatePaymentRequest['payment_type'], customer_id: undefined, supplier_id: undefined }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.payment_type === "Receipt" && (
            <div className="space-y-1">
              <Label>العميل *</Label>
              <Select value={form.customer_id} onValueChange={val => setForm(p => ({ ...p, customer_id: val }))}>
                <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.payment_type === "SupplierPayment" && (
            <div className="space-y-1">
              <Label>المورد *</Label>
              <Select value={form.supplier_id} onValueChange={val => setForm(p => ({ ...p, supplier_id: val }))}>
                <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>المبلغ *</Label>
            <Input type="number" min="0" step="0.01"
              value={form.amount || ""}
              onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label>التاريخ</Label>
            <Input type="date"
              value={form.payment_date?.slice(0, 10) ?? ""}
              onChange={e => setForm(p => ({ ...p, payment_date: new Date(e.target.value).toISOString() }))} />
          </div>
          <div className="space-y-1">
            <Label>المرجع</Label>
            <Input value={form.reference ?? ""} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>ملاحظات</Label>
            <Input value={form.notes ?? ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || !form.amount}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
