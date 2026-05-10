import { useState, useEffect, useMemo } from "react";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { AccountDto, CustomerDto, SupplierDto, PartnerDto } from "@erp/shared-types";
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { User, Building2 } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export interface PartnerFormPayload {
  id?: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  opening_balance: string;
  debit: string;
  credit: string;
  currency: string;
  account_id: string | null;
  is_active: boolean;
}

interface PartnerFormPanelProps {
  type: "customer" | "supplier";
  partner: CustomerDto | SupplierDto | PartnerDto | null;
  accounts: AccountDto[];
  onSave: (payload: PartnerFormPayload) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

export function PartnerFormPanel({
  type,
  partner,
  accounts,
  onSave,
  onClose,
  saving
}: PartnerFormPanelProps) {
  const { currencies, baseCurrency } = useCurrencyContext();
  const isCustomer = type === "customer";
  const title = isCustomer 
    ? (partner ? "تعديل بيانات العميل" : "إضافة عميل جديد")
    : (partner ? "تعديل بيانات المورد" : "إضافة مورد جديد");
  
  const labelName = isCustomer ? "اسم العميل *" : "اسم المورد *";
  const placeholderName = isCustomer ? "اسم العميل الكامل" : "اسم الشركة أو المورد";
  const Icon = isCustomer ? User : Building2;

  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [openingBalance, setOpeningBalance] = useState("0");
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");
  const [currency, setCurrency] = useState(baseCurrency?.code || "USD");

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
      setCurrency(partner.currency || baseCurrency?.code || "USD");
    } else {
      setForm({ name: "", phone: "", address: "", notes: "" });
      setOpeningBalance("0");
      setDebit("0");
      setCredit("0");
      setCurrency(baseCurrency?.code || "USD");
    }
  }, [partner, baseCurrency]);

  const handleSubmit = () => {
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
        account_id: ("account_id" in partner) ? partner.account_id : (("linked_account_id" in partner) ? (partner as PartnerDto).linked_account_id : null),
        is_active: partner.is_active, // Keep existing status if editing
      });
    } else {
      onSave({
        ...payload,
        code: "", 
        account_id: parentAccount?.id || null,
        is_active: true, // Default to true for new ones
      });
    }
  };

  return (
    <FormPanel 
      title={title}
      icon={<Icon className="w-5 h-5" />}
      onClose={onClose}
      onSave={handleSubmit}
      isSaving={saving}
    >
      <div className="space-y-6 text-right">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">المعلومات الأساسية</h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">{labelName}</Label>
              <Input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder={placeholderName} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">رقم الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="09xxxxxxx" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">العنوان</Label>
              <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="المدينة، الشارع..." className="h-9" />
            </div>
          </div>
        </div>

        {/* Financial Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">البيانات المالية</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-xs font-bold text-slate-600">الرصيد الافتتاحي</Label>
              <Input type="number" step="any" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-9 tabular-nums" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-xs font-bold text-slate-600">العملة الافتراضية</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code} - {c.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-xs font-bold text-slate-600">مدين (حالي)</Label>
              <Input type="number" step="any" value={debit} onChange={e => setDebit(e.target.value)} className="h-9 tabular-nums" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-xs font-bold text-slate-600">دائن (حالي)</Label>
              <Input type="number" step="any" value={credit} onChange={e => setCredit(e.target.value)} className="h-9 tabular-nums" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600">ملاحظات</Label>
          <Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="h-9" />
        </div>
      </div>
    </FormPanel>
  );
}
