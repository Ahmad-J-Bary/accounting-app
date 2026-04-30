import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AccountDto } from "@erp/shared-types";

interface PartnerFormDialogProps {
  type: "customer" | "supplier";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: any | null; // Unified DTO
  accounts: AccountDto[];
  onSave: (payload: any) => Promise<void>;
  saving?: boolean;
}

export function PartnerFormDialog({
  type,
  open,
  onOpenChange,
  partner,
  accounts,
  onSave,
  saving
}: PartnerFormDialogProps) {
  const isCustomer = type === "customer";
  const title = isCustomer 
    ? (partner ? "تعديل بيانات العميل" : "إضافة عميل جديد")
    : (partner ? "تعديل بيانات المورد" : "إضافة مورد جديد");
  
  const labelName = isCustomer ? "اسم العميل *" : "اسم المورد *";
  const placeholderName = isCustomer ? "اسم العميل الكامل" : "اسم الشركة أو المورد";

  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [openingBalance, setOpeningBalance] = useState("0");
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");
  const [currency, setCurrency] = useState("SYP");

  // Automatically find the parent account
  const parentAccount = useMemo(() => {
    const searchTerms = isCustomer 
      ? ["المدينون", "العملاء"] 
      : ["الدائنون", "الموردون"];
    return accounts.find(acc => searchTerms.some(term => acc.name_ar.includes(term)));
  }, [accounts, isCustomer]);

  useEffect(() => {
    if (partner) {
      setForm({
        name: partner.name,
        phone: partner.phone || "",
        address: partner.address || "",
        notes: partner.notes || ""
      });
      setOpeningBalance(partner.opening_balance || "0");
      setDebit(partner.debit || "0");
      setCredit(partner.credit || "0");
      setCurrency(partner.currency || "SYP");
    } else {
      setForm({ name: "", phone: "", address: "", notes: "" });
      setOpeningBalance("0");
      setDebit("0");
      setCredit("0");
      setCurrency("SYP");
    }
  }, [partner, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    const payload = {
      ...form,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
      opening_balance: openingBalance,
      debit,
      credit,
      currency,
    };

    if (partner) {
      onSave({
        ...payload,
        id: partner.id,
        code: partner.code,
        account_id: partner.account_id,
        is_active: partner.is_active,
      });
    } else {
      onSave({
        ...payload,
        code: "", // Backend handles code
        account_id: parentAccount?.id || null,
        is_active: true,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl overflow-y-auto max-h-[90vh]" dir="rtl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="text-right">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>أدخل البيانات الأساسية والمالية بدقة لضمان صحة التقارير.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-6 text-right">
            <div className="space-y-2 col-span-2">
              <Label className="text-xs font-bold">{labelName}</Label>
              <Input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder={placeholderName} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">رقم الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="09xxxxxxx" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">العنوان</Label>
              <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="المدينة، الشارع..." className="h-10" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">الرصيد الافتتاحي</Label>
              <Input type="number" step="any" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-10 tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">العملة</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYP">SYP - ليرة سورية</SelectItem>
                  <SelectItem value="USD">USD - دولار أمريكي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">مدين (حالي)</Label>
              <Input type="number" step="any" value={debit} onChange={e => setDebit(e.target.value)} className="h-10 tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">دائن (حالي)</Label>
              <Input type="number" step="any" value={credit} onChange={e => setCredit(e.target.value)} className="h-10 tabular-nums" />
            </div>

            <div className="space-y-2 col-span-2">
              <Label className="text-xs font-bold">ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="h-10" />
            </div>

            {parentAccount && (
              <div className={`col-span-2 p-3 rounded-lg border flex items-center gap-3 ${isCustomer ? "bg-green-50 border-green-100 text-green-800" : "bg-blue-50 border-blue-100 text-blue-800"}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${isCustomer ? "bg-green-500" : "bg-blue-500"}`} />
                <p className="text-[11px] font-medium">سيتم ربط هذا السجل تلقائياً بحساب: <strong>{parentAccount.name_ar}</strong></p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={saving} className={isCustomer ? "bg-primary" : "bg-blue-600 hover:bg-blue-700"}>
              {saving ? "جاري الحفظ..." : "حفظ البيانات"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
