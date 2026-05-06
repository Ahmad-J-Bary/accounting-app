import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupplierDto, AccountDto, CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

interface SupplierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierDto | null;
  accounts: AccountDto[];
  onSave: (payload: CreateSupplierRequest | UpdateSupplierRequest) => Promise<void>;
  saving: boolean;
}

export function SupplierForm({ open, onOpenChange, supplier, accounts, onSave, saving }: SupplierFormProps) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [openingBalance, setOpeningBalance] = useState("0");
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");
  const [currency, setCurrency] = useState("SYP");

  // Automatically find the parent account for suppliers: "الدائنون (الموردون)" or similar
  const parentAccount = useMemo(() => {
    return accounts.find(acc => acc.name_ar.includes("الدائنون") || acc.name_ar.includes("الموردون"));
  }, [accounts]);

  useEffect(() => {
    if (supplier) {
      setForm({ 
        name: supplier.name, 
        phone: supplier.phone || "", 
        address: supplier.address || "",
        notes: supplier.notes || ""
      });
      setOpeningBalance(supplier.opening_balance || "0");
      setDebit(supplier.debit || "0");
      setCredit(supplier.credit || "0");
      setCurrency(supplier.currency || "SYP");
    } else {
      setForm({ name: "", phone: "", address: "", notes: "" });
      setOpeningBalance("0");
      setDebit("0");
      setCredit("0");
      setCurrency("SYP");
    }
  }, [supplier, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    if (supplier) {
      const payload: UpdateSupplierRequest = {
        id: supplier.id,
        code: supplier.code, // Keep existing code on update
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
        account_id: supplier.account_id,
        opening_balance: openingBalance,
        debit,
        credit,
        currency,
        is_active: supplier.is_active,
      };
      onSave(payload);
    } else {
      const payload: CreateSupplierRequest = {
        code: "", // Backend or Service should handle sequential code generation if empty
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
        account_id: parentAccount?.id || null, // Link to "الدائنون" group
        opening_balance: openingBalance,
        debit,
        credit,
        currency,
        is_active: true,
      };
      onSave(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl overflow-y-auto max-h-[90vh]" dir="rtl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="text-right">
            <DialogTitle>{supplier ? "تعديل بيانات مورد" : "إضافة مورد جديد"}</DialogTitle>
            <DialogDescription>أدخل معلومات المورد الأساسية والمالية.</DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-6 text-right">
            <div className="space-y-2 col-span-2">
              <Label>اسم المورد *</Label>
              <Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="اسم الشركة أو المورد" />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="09xxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="المدينة، الشارع..." />
            </div>
            
            <div className="space-y-2">
              <Label>رصيد افتتاحي</Label>
              <Input type="number" step="any" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>العملة</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYP">ليرة سورية (SYP)</SelectItem>
                  <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>مدين (حالي)</Label>
              <Input type="number" step="any" value={debit} onChange={e => setDebit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>دائن (حالي)</Label>
              <Input type="number" step="any" value={credit} onChange={e => setCredit(e.target.value)} />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>ملاحظات</Label>
              <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>

            {parentAccount && (
              <div className="col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-800">سيتم ربط هذا المورد تلقائياً بحساب: <strong>{parentAccount.name_ar}</strong></p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ المورد"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
