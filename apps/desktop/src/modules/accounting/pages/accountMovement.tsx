import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { Button } from "@shared/ui/button";
import { Download, Printer, PlusCircle, ShoppingCart} from "lucide-react";
import { accountingService } from "@modules/accounting/api/accountingService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { partnerService } from "@modules/partners/api/partnerService";
import { paymentService } from "@modules/payments/api/paymentService";
import type { 
  AccountLedgerDto, 
  AccountLedgerLineDto, 
  AccountDto,
  CustomerDto, 
  SupplierDto, 
  PartnerDto,
  CreatePaymentRequest
} from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { AccountMovementTable } from "../components/AccountMovementTable";
import { useDataTable } from "@shared/hooks";
import { toast } from "sonner";

import { PaymentForm, PAYMENT_CONFIGS } from "@modules/partners/components/PaymentForm";
import { ExpenseVoucherForm } from "@modules/accounting/components/ExpenseVoucherForm";

const OUTLINE_BUTTON_CLASS = "border-slate-200 text-slate-700 hover:bg-slate-50";
const TOOLBAR_CLASS_BY_TYPE = {
  partner: "bg-amber-600 hover:bg-amber-700 text-white",
  customer: "bg-blue-600 hover:bg-blue-700 text-white",
  supplier: "bg-emerald-600 hover:bg-emerald-700 text-white",
  expense: "bg-red-600 hover:bg-red-700 text-white",
} as const;

export default function AccountMovement() {
  const { accountId } = useParams<{ accountId: string }>();
  const { openTab } = useTabs();
  const [ledger, setLedger] = useState<AccountLedgerDto | null>(null);
  
  // Entity Detection
  const [accountType, setAccountType] = useState<'partner' | 'customer' | 'supplier' | 'expense' | 'other'>('other');
  const [linkedEntity, setLinkedEntity] = useState<PartnerDto | CustomerDto | SupplierDto | null>(null);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [savingVoucher, setSavingVoucher] = useState(false);

  const {
    loading,
    refresh,
    search,
    setSearch,
  } = useDataTable<AccountLedgerLineDto>({
    queryKey: ["account-ledger", accountId ?? ""],
    fetchData: async () => {
      if (!accountId) return [];
      const data = await accountingService.getAccountLedger(accountId);
      setLedger(data);
      return data.lines;
    },
    searchFields: ["description", "entry_number", "opposite_account_name"]
  });

  // Detect Account Type and Linked Entity
  useEffect(() => {
    const detectType = async () => {
      if (!accountId) return;
      
      try {
        const accounts = await accountingService.getChartOfAccounts();
        const account = accounts.find(a => a.id === accountId);
        
        if (!account) return;

        const partners = await partnerService.listPartners();
        const partnerMatch = partners.find(p => p.drawings_account_id === accountId || p.linked_account_id === accountId);

        if (partnerMatch) {
          setLinkedEntity(partnerMatch);
          setAccountType('partner');
        } else if (account.linked_customer_id) {
          const cust = await customerService.getCustomer(account.linked_customer_id);
          setLinkedEntity(cust);
          setAccountType('customer');
        } else if (account.linked_supplier_id) {
          const supp = await supplierService.getSupplier(account.linked_supplier_id);
          setLinkedEntity(supp);
          setAccountType('supplier');
        } else if (account.code.startsWith('4')) {
          setAccountType('expense');
        } else {
          setAccountType('other');
          setLinkedEntity(null);
        }
      } catch (err) {
        console.error("Failed to detect account type", err);
      }
    };

    detectType();
  }, [accountId]);

  // Filter out PurchaseCostsJournal entries for supplier accounts
  const filteredLines = useMemo(() => {
    const lines = ledger?.lines || [];
    if (accountType === 'supplier') {
      return lines.filter(l => l.journal_type !== 'PurchaseCostsJournal');
    }
    return lines;
  }, [ledger, accountType]);

  const handleSaveVoucher = async (payload: CreatePaymentRequest) => {
    try {
      setSavingVoucher(true);
      await paymentService.createPayment(payload);
      await refresh(true);
      toast.success("تم تسجيل السند بنجاح");
      setIsVoucherOpen(false);
    } catch (error) {
      toast.error("فشل تسجيل السند: " + error);
    } finally {
      setSavingVoucher(false);
    }
  };

  const accountTitle = useMemo(
    () => `حركة الحساب: ${ledger?.account_name || "..."}`,
    [ledger?.account_name],
  );

  const toolbarButtons = useMemo(() => {
    const commonExcel = (
      <Button key="excel" variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
        <Download className="w-4 h-4 ml-2 text-emerald-500" />
        تصدير Excel
      </Button>
    );

    const commonPrint = (
      <Button key="print" variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS}>
        <Printer className="w-4 h-4 ml-2 text-blue-500" />
        طباعة كشف حساب
      </Button>
    );

    const linkedEntityId = linkedEntity?.id;
    const linkedEntityName = linkedEntity?.name;

    switch (accountType) {
      case 'partner':
        return [
          <Button key="drawings" size="sm" onClick={() => setIsVoucherOpen(true)} className={TOOLBAR_CLASS_BY_TYPE.partner}>
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند مسحوبات جديد
          </Button>,
          commonExcel
        ];
      case 'customer':
        return [
          <Button key="receipt" size="sm" onClick={() => setIsVoucherOpen(true)} className={TOOLBAR_CLASS_BY_TYPE.customer}>
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند قبض جديد
          </Button>,
          commonPrint,
          linkedEntityId && linkedEntityName ? (
            <Button
              key="sales"
              variant="outline"
              size="sm"
              onClick={() => {
                openTab({
                  id: `sales-cust-${linkedEntityId}`,
                  title: `مبيعات ${linkedEntityName}`,
                  path: `/sales-invoices?customerId=${linkedEntityId}`,
                  closable: true
                });
              }}
              className={OUTLINE_BUTTON_CLASS}
            >
              <ShoppingCart className="w-4 h-4 ml-2 text-blue-500" />
              المبيعات للعميل {linkedEntityName}
            </Button>
          ) : null,
          commonExcel
        ].filter(Boolean);
      case 'supplier':
        return [
          <Button key="payment" size="sm" onClick={() => setIsVoucherOpen(true)} className={TOOLBAR_CLASS_BY_TYPE.supplier}>
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند دفع جديد
          </Button>,
          commonPrint,
          linkedEntityId && linkedEntityName ? (
            <Button
              key="purchases"
              variant="outline"
              size="sm"
              onClick={() => {
                openTab({
                  id: `purchase-supp-${linkedEntityId}`,
                  title: `مشتريات ${linkedEntityName}`,
                  path: `/purchase-invoices?supplierId=${linkedEntityId}`,
                  closable: true
                });
              }}
              className={OUTLINE_BUTTON_CLASS}
            >
              <ShoppingCart className="w-4 h-4 ml-2 text-emerald-500" />
              المشتريات للمورد {linkedEntityName}
            </Button>
          ) : null,
          commonExcel
        ].filter(Boolean);
      case 'expense':
        return [
          <Button key="expense" size="sm" onClick={() => setIsVoucherOpen(true)} className={TOOLBAR_CLASS_BY_TYPE.expense}>
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند صرف جديد
          </Button>,
          commonExcel
        ];
      default:
        return [commonExcel];
    }
  }, [accountType, linkedEntity, openTab]);

  return (
    <OperationalTableTemplate
      title={accountTitle}
      toolbar={
        <div className="flex items-center gap-2">
          {toolbarButtons}
        </div>
      }
      tableContent={
        <AccountMovementTable
          lines={filteredLines}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          accountName={ledger?.account_name || ""}
        />
      }
      sidePanel={
        isVoucherOpen && (
          <>
            {accountType === 'partner' && linkedEntity && (
              <PaymentForm 
                config={PAYMENT_CONFIGS.partner({ ...(linkedEntity as PartnerDto), drawings_account_id: (linkedEntity as PartnerDto).drawings_account_id ?? undefined })}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
            {accountType === 'customer' && linkedEntity && (
              <PaymentForm 
                config={PAYMENT_CONFIGS.customer(linkedEntity as CustomerDto)}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
            {accountType === 'supplier' && linkedEntity && (
              <PaymentForm 
                config={PAYMENT_CONFIGS.supplier(linkedEntity as SupplierDto)}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
            {accountType === 'expense' && (
              <ExpenseVoucherForm 
                expenseAccount={{ 
                  id: accountId!, 
                  name_ar: ledger?.account_name || "",
                  code: "", 
                  parent_id: null,
                  account_type: "Expense",
                  is_system: false,
                  balance: "0",
                  opening_balance: "0"
                } as unknown as AccountDto}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
          </>
        )
      }
      isPanelOpen={isVoucherOpen}
    />
  );
}
