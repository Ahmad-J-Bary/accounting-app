import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { AssetCategoryDto, AccountDto, CreateConsumableRequest } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

interface ConsumableFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: AssetCategoryDto[];
  accounts: AccountDto[];
  onSave: (payload: CreateConsumableRequest) => Promise<void>;
  isSubmitting: boolean;
}

export function ConsumableForm({ open, onOpenChange, categories, accounts, onSave, isSubmitting }: ConsumableFormProps) {
  const { currencies, baseCurrency } = useCurrencyContext();
  const [form, setForm] = useState({
    code: "",
    name: "",
    categoryId: "",
    unitCost: "",
    currency: baseCurrency?.code || "",
    fxRate: "1.0",
    assetAccountId: "",
    expenseAccountId: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        code: "",
        name: "",
        categoryId: "",
        unitCost: "",
        currency: baseCurrency?.code || "",
        fxRate: "1.0",
        assetAccountId: "",
        expenseAccountId: "",
      });
    }
  }, [open, baseCurrency]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader><DialogTitle>إضافة مادة مستهلكة جديدة</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>الكود</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
            <div className="space-y-2"><Label>الاسم</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          </div>
          <div className="space-y-2">
            <Label>التصنيف</Label>
            <Select value={form.categoryId} onValueChange={v => setForm({...form, categoryId: v})}>
              <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
              <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>تكلفة الوحدة</Label><Input type="number" value={form.unitCost} onChange={e => setForm({...form, unitCost: e.target.value})}/></div>
            <div className="space-y-2"><Label>العملة</Label><Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{currencies.filter(c => c.is_active).map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>حساب الأصول</Label><Select value={form.assetAccountId} onValueChange={v => setForm({...form, assetAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.filter(a => a.account_type === 'Assets').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>حساب المصروف</Label><Select value={form.expenseAccountId} onValueChange={v => setForm({...form, expenseAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.filter(a => a.account_type === 'Expenses').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => onSave(form)} disabled={isSubmitting}>{isSubmitting ? "جاري الحفظ..." : "حفظ"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
