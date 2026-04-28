import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomerDto, AccountDto, CreateCustomerRequest, UpdateCustomerRequest } from "@erp/shared-types";

interface CustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerDto | null;
  accounts: AccountDto[];
  onSave: (payload: CreateCustomerRequest | UpdateCustomerRequest) => Promise<void>;
  saving?: boolean;
}

export function CustomerForm({ open, onOpenChange, customer, accounts, onSave, saving }: CustomerFormProps) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [openingBalance, setOpeningBalance] = useState("0");
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");
  const [currency, setCurrency] = useState("SYP");

  // Automatically find the parent account for customers: "المدينون (العملاء والزبائن)" or similar
  const parentAccount = useMemo(() => {
    return accounts.find(acc => acc.name_ar.includes("المدينون") || acc.name_ar.includes("العملاء"));
  }, [accounts]);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone || "",
        address: customer.address || "",
        notes: customer.notes || ""
      });
      setOpeningBalance(customer.opening_balance || "0");
      setDebit(customer.debit || "0");
      setCredit(customer.credit || "0");
      setCurrency(customer.currency || "SYP");
    } else {
      setForm({ name: "", phone: "", address: "", notes: "" });
      setOpeningBalance("0");
      setDebit("0");
      setCredit("0");
      setCurrency("SYP");
    }
  }, [customer, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    if (customer) {
      onSave({
        id: customer.id,
        code: customer.code, // Keep existing code
        ...form,
        account_id: customer.account_id,
        opening_balance: openingBalance,
        debit,
        credit,
        currency,
        is_active: customer.is_active,
      } as UpdateCustomerRequest);
    } else {
      onSave({
        ...form,
        code: "", // Service handles sequential code
        account_id: parentAccount?.id || null, // Link to "المدينون"
        opening_balance: openingBalance,
        debit,
        credit,
        currency,
        is_active: true,
      } as CreateCustomerRequest);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl overflow-y-auto max-h-[90vh]" dir="rtl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="text-right">
            <DialogTitle>{customer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle>
            <DialogDescription>أدخل بيانات العميل الأساسية والمالية.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-6 text-right">
            <div className="space-y-2 col-span-2">
              <Label>اسم العميل *</Label>
              <Input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="اسم العميل الكامل" />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="09xxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="المدينة، الشارع..." />
            </div>

            <div className="space-y-2">
              <Label>الرصيد الافتتاحي</Label>
              <Input type="number" step="any" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>العملة</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYP">SYP - ليرة سورية</SelectItem>
                  <SelectItem value="USD">USD - دولار أمريكي</SelectItem>
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
              <Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
            </div>

            {parentAccount && (
              <div className="col-span-2 p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs text-green-800">سيتم ربط هذا العميل تلقائياً بحساب: <strong>{parentAccount.name_ar}</strong></p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ العميل"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
