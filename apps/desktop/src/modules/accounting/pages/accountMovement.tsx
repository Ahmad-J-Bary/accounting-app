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
import { cn } from "@shared/lib/utils";
import { useDataTable } from "@shared/hooks";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { toast } from "sonner";

// Forms
import { CustomerReceiptForm } from "@modules/partners/components/CustomerReceiptForm";
import { SupplierPaymentForm } from "@modules/partners/components/SupplierPaymentForm";
import { ExpenseVoucherForm } from "@modules/accounting/components/ExpenseVoucherForm";
import { PartnerDrawingsForm } from "@modules/partners/components/PartnerDrawingsForm";

export default function AccountMovement() {
  const { accountId } = useParams<{ accountId: string }>();
  const { openTab } = useTabs();
  const { formatAmount } = useCurrencyContext();
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
    fetchData: async () => {
      if (!accountId) return [];
      const data = await accountingService.getAccountLedger(accountId);
      setLedger(data);
      return data.lines;
    },
    dependencies: [accountId],
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

  const stats = useMemo(() => {
    if (!ledger) return null;
    return [
      {
        label: "الرصيد الافتتاحي",
        value: `${formatAmount(parseFloat(ledger.opening_balance_usd), { currencyCode: "USD" })} / ${formatAmount(parseFloat(ledger.opening_balance_usd), { currencyCode: "SYP" })}`,
        color: "text-slate-600"
      },
      {
        label: "إجمالي مدين",
        value: `${formatAmount(parseFloat(ledger.total_debit_usd), { currencyCode: "USD" })} / ${formatAmount(parseFloat(ledger.total_debit_usd), { currencyCode: "SYP" })}`,
        color: "text-blue-600"
      },
      {
        label: "إجمالي دائن",
        value: `${formatAmount(parseFloat(ledger.total_credit_usd), { currencyCode: "USD" })} / ${formatAmount(parseFloat(ledger.total_credit_usd), { currencyCode: "SYP" })}`,
        color: "text-emerald-600"
      },
      {
        label: "الرصيد الحالي",
        value: `${formatAmount(parseFloat(ledger.closing_balance_usd), { currencyCode: "USD" })} / ${formatAmount(parseFloat(ledger.closing_balance_usd), { currencyCode: "SYP" })}`,
        color: "text-slate-900 font-black",
        highlight: true
      }
    ];
  }, [ledger, formatAmount]);

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

  const toolbarButtons = useMemo(() => {
    const commonExcel = (
      <Button key="excel" variant="outline" size="sm" className="border-slate-200 text-slate-700 hover:bg-slate-50">
        <Download className="w-4 h-4 ml-2 text-emerald-500" />
        تصدير Excel
      </Button>
    );

    const commonPrint = (
      <Button key="print" variant="outline" size="sm" className="border-slate-200 text-slate-700 hover:bg-slate-50">
        <Printer className="w-4 h-4 ml-2 text-blue-500" />
        طباعة كشف حساب
      </Button>
    );

    switch (accountType) {
      case 'partner':
        return [
          <Button key="drawings" size="sm" onClick={() => setIsVoucherOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند مسحوبات جديد
          </Button>,
          commonExcel
        ];
      case 'customer':
        return [
          <Button key="receipt" size="sm" onClick={() => setIsVoucherOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند قبض جديد
          </Button>,
          commonPrint,
          <Button key="sales" variant="outline" size="sm" onClick={() => {
            openTab({
              id: `sales-cust-${linkedEntity.id}`,
              title: `مبيعات ${linkedEntity.name}`,
              path: `/sales-invoices?customerId=${linkedEntity.id}`,
              closable: true
            });
          }} className="border-slate-200 text-slate-700 hover:bg-slate-50">
            <ShoppingCart className="w-4 h-4 ml-2 text-blue-500" />
            المبيعات للعميل {linkedEntity.name}
          </Button>,
          commonExcel
        ];
      case 'supplier':
        return [
          <Button key="payment" size="sm" onClick={() => setIsVoucherOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <PlusCircle className="w-4 h-4 ml-2" />
            إنشاء سند دفع جديد
          </Button>,
          commonPrint,
          <Button key="purchases" variant="outline" size="sm" onClick={() => {
            openTab({
              id: `purchase-supp-${linkedEntity.id}`,
              title: `مشتريات ${linkedEntity.name}`,
              path: `/purchase-invoices?supplierId=${linkedEntity.id}`,
              closable: true
            });
          }} className="border-slate-200 text-slate-700 hover:bg-slate-50">
            <ShoppingCart className="w-4 h-4 ml-2 text-emerald-500" />
            المشتريات للمورد {linkedEntity.name}
          </Button>,
          commonExcel
        ];
      case 'expense':
        return [
          <Button key="expense" size="sm" onClick={() => setIsVoucherOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
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
      title={`حركة اليومية للحساب: ${ledger?.account_name || "..."}`}
      toolbar={
        <div className="flex items-center gap-2">
          {toolbarButtons}
        </div>
      }
      filterBar={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
             {stats?.map((s, i) => (
               <div key={i} className="flex flex-col border-l last:border-0 border-slate-200 pl-4">
                 <span className="text-[10px] text-slate-500 font-bold">{s.label}</span>
                 <span className={cn("text-xs font-black tabular-nums", s.color)}>{s.value}</span>
               </div>
             ))}
          </div>
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
          <div className="p-6 h-full overflow-y-auto">
            {accountType === 'partner' && linkedEntity && (
              <PartnerDrawingsForm 
                partner={linkedEntity as PartnerDto}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
            {accountType === 'customer' && linkedEntity && (
              <CustomerReceiptForm 
                customer={linkedEntity as CustomerDto}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
            {accountType === 'supplier' && linkedEntity && (
              <SupplierPaymentForm 
                supplier={linkedEntity as SupplierDto}
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
                  balance_usd: "0",
                  balance_syp: "0"
                } as unknown as AccountDto}
                onSave={handleSaveVoucher}
                onClose={() => setIsVoucherOpen(false)}
                saving={savingVoucher}
              />
            )}
          </div>
        )
      }
      isPanelOpen={isVoucherOpen}
    />
  );
}
