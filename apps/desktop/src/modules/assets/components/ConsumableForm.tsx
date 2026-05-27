import { useState, useEffect } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { AssetCategoryDto, AccountDto, CreateConsumableRequest } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { DialogForm } from "@widgets/sidebar/DialogForm";
import { SidebarSection } from "@widgets/sidebar/SidebarSection";
import { FieldLabel } from "@widgets/sidebar/FieldLabel";

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
        code: "", name: "", categoryId: "", unitCost: "",
        currency: baseCurrency?.code || "", fxRate: "1.0",
        assetAccountId: "", expenseAccountId: "",
      });
    }
  }, [open, baseCurrency]);

  return (
    <DialogForm
      open={open}
      onOpenChange={onOpenChange}
      title="إضافة مادة مستهلكة جديدة"
      onSave={() => onSave(form)}
      isSaving={isSubmitting}
    >
      <SidebarSection title="البيانات الأساسية">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel>الكود</FieldLabel>
            <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
          </div>
          <div className="space-y-2">
            <FieldLabel>الاسم</FieldLabel>
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel>التصنيف</FieldLabel>
          <Select value={form.categoryId} onValueChange={v => setForm({...form, categoryId: v})}>
            <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
            <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </SidebarSection>

      <SidebarSection title="التسعير">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel required>تكلفة الوحدة</FieldLabel>
            <Input type="number" value={form.unitCost} onChange={e => setForm({...form, unitCost: e.target.value})} />
          </div>
          <div className="space-y-2">
            <FieldLabel>العملة</FieldLabel>
            <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{currencies.filter(c => c.is_active).map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="الحسابات المحاسبية">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel>حساب الأصول</FieldLabel>
            <Select value={form.assetAccountId} onValueChange={v => setForm({...form, assetAccountId: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.filter(a => a.account_type === 'Assets').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel>حساب المصروف</FieldLabel>
            <Select value={form.expenseAccountId} onValueChange={v => setForm({...form, expenseAccountId: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.filter(a => a.account_type === 'Expenses').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </SidebarSection>
    </DialogForm>
  );
}
