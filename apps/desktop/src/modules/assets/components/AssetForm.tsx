import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { AssetCategoryDto, AccountDto } from "@erp/shared-types";

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
  const [form, setForm] = useState({
    code: "",
    name: "",
    categoryId: "",
    purchaseDate: new Date().toISOString(),
    purchaseCost: "",
    currency: "SYP",
    fxRate: "1.0",
    usefulLifeMonths: 60,
    assetAccountId: "",
    depreciationAccountId: "",
    accumulatedDepreciationAccountId: "",
    paymentAccountId: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        code: "",
        name: "",
        categoryId: "",
        purchaseDate: new Date().toISOString(),
        purchaseCost: "",
        currency: "SYP",
        fxRate: "1.0",
        usefulLifeMonths: 60,
        assetAccountId: "",
        depreciationAccountId: "",
        accumulatedDepreciationAccountId: "",
        paymentAccountId: "",
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>إضافة أصل ثابت جديد</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>كود الأصل</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
            <div className="space-y-2"><Label>اسم الأصل</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>التصنيف</Label>
              <Select value={form.categoryId} onValueChange={v => setForm({...form, categoryId: v})}>
                <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                <SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>العمر الإنتاجي (شهور)</Label><Input type="number" value={form.usefulLifeMonths} onChange={e => setForm({...form, usefulLifeMonths: parseInt(e.target.value)})} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>العملة</Label><Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="SYP">SYP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>تكلفة الشراء</Label><Input type="number" value={form.purchaseCost} onChange={e => setForm({...form, purchaseCost: e.target.value})}/></div>
            <div className="space-y-2"><Label>سعر الصرف</Label><Input type="number" value={form.fxRate} onChange={e => setForm({...form, fxRate: e.target.value})} disabled={form.currency === 'SYP'}/></div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2"><Label>حساب الأصول</Label><Select value={form.assetAccountId} onValueChange={v => setForm({...form, assetAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.filter(a => a.account_type === 'Assets').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>حساب الدفع</Label><Select value={form.paymentAccountId} onValueChange={v => setForm({...form, paymentAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>حساب مصروف الإهلاك</Label><Select value={form.depreciationAccountId} onValueChange={v => setForm({...form, depreciationAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.filter(a => a.account_type === 'Expenses').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>حساب مجمع الإهلاك</Label><Select value={form.accumulatedDepreciationAccountId} onValueChange={v => setForm({...form, accumulatedDepreciationAccountId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{accounts.filter(a => a.account_type === 'Assets' || a.account_type === 'Liabilities').map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name_ar}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => onSave(form)} disabled={isSubmitting}>{isSubmitting ? "جاري الحفظ..." : "حفظ"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
