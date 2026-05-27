import { useState, useEffect } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { AssetCategoryDto, AccountDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { DialogForm } from "@widgets/sidebar-shell/DialogForm";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";

type CreateFixedAssetRequest = {
  code: string; name: string; categoryId: string; purchaseDate: string;
  purchaseCost: string; currency: string; fxRate: string;
  usefulLifeMonths: number; assetAccountId: string;
  depreciationAccountId: string; accumulatedDepreciationAccountId: string;
  paymentAccountId: string;
};

interface AssetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: AssetCategoryDto[];
  accounts: AccountDto[];
  onSave: (payload: CreateFixedAssetRequest) => Promise<void>;
  isSubmitting: boolean;
}

export function AssetForm({ open, onOpenChange, categories, accounts, onSave, isSubmitting }: AssetFormProps) {
  const { currencies, baseCurrency } = useCurrencyContext();
  const [form, setForm] = useState({
    code: "", name: "", categoryId: "", purchaseDate: new Date().toISOString(),
    purchaseCost: "", currency: baseCurrency?.code || "", fxRate: "1.0",
    usefulLifeMonths: 60, assetAccountId: "", depreciationAccountId: "",
    accumulatedDepreciationAccountId: "", paymentAccountId: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        code: "", name: "", categoryId: "", purchaseDate: new Date().toISOString(),
        purchaseCost: "", currency: baseCurrency?.code || "", fxRate: "1.0",
        usefulLifeMonths: 60, assetAccountId: "", depreciationAccountId: "",
        accumulatedDepreciationAccountId: "", paymentAccountId: "",
      });
    }
  }, [open, baseCurrency?.code]);

  return (
    <DialogForm
      open={open}
      onOpenChange={onOpenChange}
      title="إضافة أصل ثابت جديد"
      onSave={() => onSave(form)}
      isSaving={isSubmitting}
    >
      <SidebarSection title="البيانات الأساسية">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel>كود الأصل</FieldLabel>
            <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
          </div>
          <div className="space-y-2">
            <FieldLabel>اسم الأصل</FieldLabel>
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel>التصنيف</FieldLabel>
            <Select value={form.categoryId} onValueChange={v => setForm({...form, categoryId: v})}>
              <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
              <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel>العمر الإنتاجي (شهور)</FieldLabel>
            <Input type="number" value={form.usefulLifeMonths} onChange={e => setForm({...form, usefulLifeMonths: parseInt(e.target.value)})} />
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="الشراء والتسعير">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <FieldLabel>العملة</FieldLabel>
            <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{currencies.filter(c => c.is_active).map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel>تكلفة الشراء</FieldLabel>
            <Input type="number" value={form.purchaseCost} onChange={e => setForm({...form, purchaseCost: e.target.value})} />
          </div>
          <div className="space-y-2">
            <FieldLabel>سعر الصرف</FieldLabel>
            <Input type="number" value={form.fxRate} onChange={e => setForm({...form, fxRate: e.target.value})} disabled={form.currency === baseCurrency?.code} />
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
            <FieldLabel>حساب الدفع</FieldLabel>
            <Select value={form.paymentAccountId} onValueChange={v => setForm({...form, paymentAccountId: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel>حساب مصروف الإهلاك</FieldLabel>
            <Select value={form.depreciationAccountId} onValueChange={v => setForm({...form, depreciationAccountId: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.filter(a => a.account_type === 'Expenses').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel>حساب مجمع الإهلاك</FieldLabel>
            <Select value={form.accumulatedDepreciationAccountId} onValueChange={v => setForm({...form, accumulatedDepreciationAccountId: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.filter(a => a.account_type === 'Assets' || a.account_type === 'Liabilities').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </SidebarSection>
    </DialogForm>
  );
}
