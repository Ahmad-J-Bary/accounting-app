import { useState, useEffect, useMemo, useRef } from "react";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { SYSTEM_ACCOUNT_IDS, type AccountDto, type CustomerDto, type SupplierDto, type PartnerDto } from "@erp/shared-types";
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { FieldLabel } from '@widgets/sidebar-shell/FieldLabel';
import { SidebarSection } from '@widgets/sidebar-shell/SidebarSection';
import { User, Building2 } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
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
  /** When editing from the Chart of Accounts, these read-only account fields are displayed. */
  accountInfo?: { code: string; parentName: string };
}

export function PartnerFormPanel({
  type,
  partner,
  accounts,
  onSave,
  onClose,
  saving,
  accountInfo
}: PartnerFormPanelProps) {
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();
  const { t } = useLocalization();
  const { canAccessOpeningWorkflow, isExistingCompany } = useCompanyCapabilities();
  const isCustomer = type === "customer";
  // An existing company (شركة قائمة) records opening balances against vendors
  // as liabilities (credit is the normal balance), so the supplier direction
  // defaults to دائن.
  const defaultBalanceDirection: "debit" | "credit" =
    isExistingCompany && !isCustomer ? "credit" : "debit";
  const title = isCustomer 
    ? (partner ? t("partyForm.customerTitleEdit", { namespace: "partners",  }) : t("partyForm.customerTitleCreate", { namespace: "partners",  }))
    : (partner ? t("partyForm.supplierTitleEdit", { namespace: "partners",  }) : t("partyForm.supplierTitleCreate", { namespace: "partners",  }));
  
  const labelName = isCustomer ? t("columns.nameCustomer", { namespace: "partners",  }) : t("columns.nameSupplier", { namespace: "partners",  });
  const placeholderName = isCustomer ? t("partyForm.customerNamePlaceholder", { namespace: "partners",  }) : t("partyForm.supplierNamePlaceholder", { namespace: "partners",  });
  const Icon = isCustomer ? User : Building2;

  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [openingBalance, setOpeningBalance] = useState("0");
  const [balanceDirection, setBalanceDirection] = useState<"debit" | "credit">(
    defaultBalanceDirection,
  );
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
      const cs = partner as CustomerDto | SupplierDto;
      setForm({
        name: cs.name,
        phone: cs.phone || "",
        address: cs.address || "",
        notes: cs.notes || ""
      });
      setOpeningBalance(cs.opening_balance || "0");
      const pDebit = parseFloat(cs.debit || "0");
      setBalanceDirection(pDebit > 0 ? "debit" : "credit");
      setCurrency(cs.currency || baseCurrency?.code || "");
      oldDebitRef.current = cs.debit || "0";
      oldCreditRef.current = cs.credit || "0";
    } else {
      setForm({ name: "", phone: "", address: "", notes: "" });
      setOpeningBalance("0");
      setBalanceDirection(defaultBalanceDirection);
      setCurrency(baseCurrency?.code || "");
      oldDebitRef.current = "0";
      oldCreditRef.current = "0";
    }
  }, [partner, baseCurrency, defaultBalanceDirection]);

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

    const cs = partner as CustomerDto | SupplierDto;
    const fullPayload: PartnerFormPayload = partner
      ? { ...payload, id: cs.id, code: cs.code, account_id: ("account_id" in cs) ? cs.account_id : null, is_active: cs.is_active }
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
            <AlertDialogTitle>{t("partyForm.confirmTitle", { namespace: "partners",  })}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>{isCustomer ? t("partyForm.confirmDescCustomer", { namespace: "partners",  }) : t("partyForm.confirmDescSupplier", { namespace: "partners",  })}</p>
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <p><span className="font-bold">{t("partyForm.oldBalance", { namespace: "partners",  })}</span> {toFixed(oldBal, 2)}</p>
                <p><span className="font-bold">{t("partyForm.newBalance", { namespace: "partners",  })}</span> {toFixed(newBal, 2)}</p>
                <p><span className="font-bold">{t("partyForm.difference", { namespace: "partners",  })}</span> {toFixed(newBal - oldBal, 2)}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {isCustomer ? t("partyForm.confirmFootnoteCustomer", { namespace: "partners",  }) : t("partyForm.confirmFootnoteSupplier", { namespace: "partners",  })}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel", { namespace: "partners",  })}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmed}>{t("partyForm.confirmApply", { namespace: "partners",  })}</AlertDialogAction>
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
          <SidebarSection title={t("partyForm.basicSection", { namespace: "partners",  })}>
            <div className="space-y-3">
              {accountInfo && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel>{t("form.accountNumber", { namespace: "partners",  })}</FieldLabel>
                    <Input value={accountInfo.code} readOnly className="h-9 bg-muted border-muted cursor-not-allowed" />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>{t("form.parentOf", { namespace: "partners",  })}</FieldLabel>
                    <Input value={accountInfo.parentName} readOnly className="h-9 bg-muted border-muted cursor-not-allowed" />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <FieldLabel>{labelName}</FieldLabel>
                <Input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder={placeholderName} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("partyForm.phone", { namespace: "partners",  })}</FieldLabel>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder={t("partyForm.phonePlaceholder", { namespace: "partners",  })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("partyForm.address", { namespace: "partners",  })}</FieldLabel>
                <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder={t("partyForm.addressPlaceholder", { namespace: "partners",  })} className="h-9" />
              </div>
            </div>
          </SidebarSection>

          {canAccessOpeningWorkflow && (
          <SidebarSection title={t("partyForm.financialSection", { namespace: "partners",  })}>
            {currencies.length > 1 && (
              <div className="space-y-1.5 mb-3">
                <FieldLabel>{t("partyForm.defaultCurrency", { namespace: "partners",  })}</FieldLabel>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <FieldLabel>{t("partyForm.openingBalance", { namespace: "partners",  })}</FieldLabel>
                <Input type="number" step="any" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-9 tabular-nums" />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <FieldLabel>{t("partyForm.balanceDirection", { namespace: "partners",  })}</FieldLabel>
                <div className="flex gap-2 h-9">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-md text-sm font-bold transition-colors border",
                      balanceDirection === "debit"
                        ? "bg-primary/20 text-blue-700 border-blue-300"
                        : "bg-muted text-muted-foreground border-muted hover:bg-muted"
                    )}
                    onClick={() => setBalanceDirection("debit")}
                  >
                    {t("directions.debit", { namespace: "partners",  })}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-md text-sm font-bold transition-colors border",
                      balanceDirection === "credit"
                        ? "bg-success/20 text-success border-success/30"
                        : "bg-muted text-muted-foreground border-muted hover:bg-muted"
                    )}
                    onClick={() => setBalanceDirection("credit")}
                  >
                    {t("directions.credit", { namespace: "partners",  })}
                  </button>
                </div>
              </div>
            </div>
          </SidebarSection>
        )}

          <div className="space-y-1.5">
            <FieldLabel>{t("form.notes", { namespace: "partners",  })}</FieldLabel>
            <Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="min-h-[60px] bg-white border-muted" placeholder={t("form.notesPlaceholder", { namespace: "partners",  })} />
          </div>
        </div>
      </FormPanel>
    </>
  );
}
