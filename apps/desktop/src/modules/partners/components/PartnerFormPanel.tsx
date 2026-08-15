import { useState, useEffect, useMemo, useRef } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { SYSTEM_ACCOUNT_IDS, type AccountDto, type CustomerDto, type SupplierDto, type PartnerDto } from "@erp/shared-types";
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { FieldLabel } from '@widgets/sidebar-shell/FieldLabel';
import { SidebarSection } from '@widgets/sidebar-shell/SidebarSection';
import { User, Building2 } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useCompanyCapabilities } from "@shared/hooks";
import { toFixed } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { getExchangeRate } from "@shared/lib/currency-strategy";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@shared/ui/alert-dialog";

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
  exchange_rate: string;
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
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();
  const { canUseOpeningWorkflow } = useCompanyCapabilities();
  const isCustomer = type === "customer";
  const title = isCustomer 
    ? (partner ? "تعديل بيانات العميل" : "إضافة عميل جديد")
    : (partner ? "تعديل بيانات المورد" : "إضافة مورد جديد");
  
  const labelName = isCustomer ? "اسم العميل *" : "اسم المورد *";
  const placeholderName = isCustomer ? "اسم العميل الكامل" : "اسم الشركة أو المورد";
  const Icon = isCustomer ? User : Building2;

  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [openingBalance, setOpeningBalance] = useState("0");
  const [balanceDirection, setBalanceDirection] = useState<"debit" | "credit">("debit");
  const [currency, setCurrency] = useState(baseCurrency?.code || "");

  const oldDebitRef = useRef("0");
  const oldCreditRef = useRef("0");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingPayloadRef = useRef<PartnerFormPayload | null>(null);

  const parentAccount = useMemo(() => {
    const parentId = isCustomer ? SYSTEM_ACCOUNT_IDS.CUSTOMERS : SYSTEM_ACCOUNT_IDS.SUPPLIERS;
    return accounts.find(acc => acc.id === parentId);
  }, [accounts, isCustomer]);

  const computedDebit = balanceDirection === "debit" ? openingBalance : "0";
  const computedCredit = balanceDirection === "credit" ? openingBalance : "0";

  useEffect(() => {
    if (partner) {
      setForm({
        name: partner.name,
        phone: partner.phone || "",
        address: partner.address || "",
        notes: partner.notes || ""
      });
      setOpeningBalance(partner.opening_balance || "0");
      const pDebit = parseFloat(partner.debit || "0");
      setBalanceDirection(pDebit > 0 ? "debit" : "credit");
      setCurrency(partner.currency || baseCurrency?.code || "");
      oldDebitRef.current = partner.debit || "0";
      oldCreditRef.current = partner.credit || "0";
    } else {
      setForm({ name: "", phone: "", address: "", notes: "" });
      setOpeningBalance("0");
      setBalanceDirection("debit");
      setCurrency(baseCurrency?.code || "");
      oldDebitRef.current = "0";
      oldCreditRef.current = "0";
    }
  }, [partner, baseCurrency]);

  const balanceChanged = partner != null && (
    computedDebit !== oldDebitRef.current || computedCredit !== oldCreditRef.current
  );

  const handleSubmit = () => {
    if (!form.name) return;

    const exchangeRate = getExchangeRate(currency, rateMap, baseCurrency?.code);

    const payload = {
      ...form,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
      opening_balance: openingBalance,
      debit: computedDebit,
      credit: computedCredit,
      currency,
      exchange_rate: exchangeRate.toString(),
    };

    const fullPayload: PartnerFormPayload = partner
      ? { ...payload, id: partner.id, code: partner.code, account_id: ("account_id" in partner) ? partner.account_id : (("linked_account_id" in partner) ? (partner as PartnerDto).linked_account_id : null), is_active: partner.is_active }
      : { ...payload, code: "", account_id: parentAccount?.id || null, is_active: true };

    if (balanceChanged) {
      pendingPayloadRef.current = fullPayload;
      setConfirmOpen(true);
    } else {
      onSave(fullPayload);
    }
  };

  const handleConfirmed = () => {
    setConfirmOpen(false);
    if (pendingPayloadRef.current) {
      onSave(pendingPayloadRef.current);
      pendingPayloadRef.current = null;
    }
  };

  const oldBal = parseFloat(oldDebitRef.current) - parseFloat(oldCreditRef.current);
  const newBal = parseFloat(computedDebit) - parseFloat(computedCredit);

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تعديل الرصيد</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>سيتم تعديل رصيد {isCustomer ? "العميل" : "المورد"} مع إنشاء قيد يومية مقابل للتسوية.</p>
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <p><span className="font-bold">الرصيد القديم:</span> {toFixed(oldBal, 2)}</p>
                <p><span className="font-bold">الرصيد الجديد:</span> {toFixed(newBal, 2)}</p>
                <p><span className="font-bold">الفرق:</span> {toFixed(newBal - oldBal, 2)}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                سيتم إنشاء قيد محاسبي من نوع "رصيد افتتاحي" بين حساب {isCustomer ? "العميل" : "المورد"} وحساب الرصيد الافتتاحي (53).
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmed}>تأكيد التعديل</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FormPanel 
        title={title}
        icon={<Icon className="w-5 h-5" />}
        onClose={onClose}
        onSave={handleSubmit}
        isSaving={saving}
      >
        <div className="space-y-6 text-right">
          <SidebarSection title="المعلومات الأساسية">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <FieldLabel>{labelName}</FieldLabel>
                <Input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder={placeholderName} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>رقم الهاتف</FieldLabel>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="09xxxxxxx" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>العنوان</FieldLabel>
                <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="المدينة، الشارع..." className="h-9" />
              </div>
            </div>
          </SidebarSection>

          <SidebarSection title="البيانات المالية">
            <div className={`grid ${canUseOpeningWorkflow ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
              {canUseOpeningWorkflow && (
                <>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <FieldLabel>الرصيد الافتتاحي</FieldLabel>
                    <Input type="number" step="any" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-9 tabular-nums" />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <FieldLabel>اتجاه الرصيد</FieldLabel>
                    <div className="flex gap-2 h-9">
                      <button
                        type="button"
                        className={cn(
                          "flex-1 rounded-md text-sm font-bold transition-colors border",
                          balanceDirection === "debit"
                            ? "bg-blue-100 text-blue-700 border-blue-300"
                            : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                        )}
                        onClick={() => setBalanceDirection("debit")}
                      >
                        مدين
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "flex-1 rounded-md text-sm font-bold transition-colors border",
                          balanceDirection === "credit"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                            : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                        )}
                        onClick={() => setBalanceDirection("credit")}
                      >
                        دائن
                      </button>
                    </div>
                  </div>
                </>
              )}
              {currencies.length > 1 && (
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <FieldLabel>العملة الافتراضية</FieldLabel>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.code} - {c.name_ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}
            </div>
          </SidebarSection>

          <div className="space-y-1.5">
            <FieldLabel>ملاحظات</FieldLabel>
            <Input value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="h-9" />
          </div>
        </div>
      </FormPanel>
    </>
  );
}
