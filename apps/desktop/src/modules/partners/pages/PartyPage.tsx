import { useState, useCallback, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Plus, History, ShoppingBag, Printer, Download, Undo2, Receipt, DollarSign } from "lucide-react";
import { toast } from "sonner";

import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';
import { accountingService } from '@modules/accounting/api/accountingService';
import { paymentService } from '@modules/payments/api/paymentService';
import type { AccountDto, CreatePaymentRequest, CustomerDto, SupplierDto, CreateCustomerRequest, UpdateCustomerRequest, CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

import { useTabs } from "@app/providers/TabContext";
import { useEntityList } from '@shared/hooks/useEntityList';
import { PartyTable } from '@modules/partners/components/PartyTable';
import { PaymentForm, PAYMENT_CONFIGS } from '@modules/partners/components/PaymentForm';
import { ReturnFromMaterialPanel } from '@modules/inventory/components/ReturnFromMaterialPanel';
import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { PartnerDetailPanel } from '@modules/partners/components/PartnerDetailPanel';
import { PartnerFormPanel } from '@modules/partners/components/PartnerFormPanel';
import { useCurrencyContext } from "@app/providers/CurrencyContext";

// ── Entity-specific configuration ──────────────────────────────────────────────

interface PartyPageConfig {
  title: string;
  addButtonLabel: string;
  eventType: string;
  invoiceType: "Sales" | "Purchase";
  returnReturnType: "sales" | "purchase";
  paymentConfig: (entity: CustomerDto | SupplierDto) => ReturnType<typeof PAYMENT_CONFIGS.customer>;
  statementPath: (id: string, name: string) => { id: string; title: string; path: string };
  invoicesTab: (id: string, name: string) => { id: string; title: string; path: string };
  successMessage: string;
}

const PARTY_CONFIGS: Record<string, PartyPageConfig> = {
  customer: {
    title: "إدارة العملاء",
    addButtonLabel: "إضافة عميل جديد",
    eventType: "erp:open-new-customer",
    invoiceType: "Sales",
    returnReturnType: "sales",
    paymentConfig: (entity) => PAYMENT_CONFIGS.customer(entity as CustomerDto),
    statementPath: (id, name) => ({
      id: `statement-${id}`,
      title: `كشف: ${name}`,
      path: `/partners/customer-statement/${id}`,
    }),
    invoicesTab: (id, name) => ({
      id: `sales-customer-${id}`,
      title: `مبيعات: ${name}`,
      path: `/sales-invoices?customerId=${id}`,
    }),
    successMessage: "تم تسجيل سند القبض بنجاح",
  },
  supplier: {
    title: "إدارة الموردين",
    addButtonLabel: "مورد جديد",
    eventType: "erp:open-new-supplier",
    invoiceType: "Purchase",
    returnReturnType: "purchase",
    paymentConfig: (entity) => PAYMENT_CONFIGS.supplier(entity as SupplierDto),
    statementPath: (id, name) => ({
      id: `statement-supplier-${id}`,
      title: `كشف: ${name}`,
      path: `/partners/supplier-statement/${id}`,
    }),
    invoicesTab: (id, name) => ({
      id: `purchases-supplier-${id}`,
      title: `مشتريات: ${name}`,
      path: `/purchase-invoices?supplierId=${id}`,
    }),
    successMessage: "تم تسجيل سند الدفع بنجاح",
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

interface PartyPageProps {
  entityName: "customer" | "supplier";
}

export default function PartyPage({ entityName }: PartyPageProps) {
  const cfg = PARTY_CONFIGS[entityName];
  const { openTab } = useTabs();
  const { rateMap } = useCurrencyContext();
  const [rateMapKey, setRateMapKey] = useState(0);

  useEffect(() => {
    setRateMapKey(k => k + 1);
  }, [rateMap]);

  // ── CRUD via useEntityList ──

  const {
    filtered: items,
    loading,
    search,
    setSearch,
    refresh,
    refreshing,
    selectedId,
    setSelectedId,
    selectedItem,
    editItem,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  } = useEntityList<CustomerDto | SupplierDto, CreateCustomerRequest | UpdateCustomerRequest | CreateSupplierRequest | UpdateSupplierRequest>({
    queryKey: ["partners", entityName === "customer" ? "customers" : "suppliers"],
    fetchData: entityName === "customer"
      ? () => customerService.listCustomers()
      : () => supplierService.listSuppliers(),
    saveData: async (payload) => {
      if (entityName === "customer") {
        const customerPayload = payload as CreateCustomerRequest | UpdateCustomerRequest;
        if ("id" in customerPayload && customerPayload.id) {
          return customerService.updateCustomer(customerPayload);
        }
        return customerService.createCustomer(customerPayload);
      } else {
        const supplierPayload = payload as CreateSupplierRequest | UpdateSupplierRequest;
        if ("id" in supplierPayload && supplierPayload.id) {
          return supplierService.updateSupplier(supplierPayload);
        }
        return supplierService.createSupplier(supplierPayload);
      }
    },
    deleteData: async (id) => {
      if (entityName === "customer") {
        return customerService.deleteCustomer(id);
      } else {
        return supplierService.deleteSupplier(id);
      }
    },
    searchFields: ["name", "phone", "code"],
  });

  // ── Payment (receipt / payment voucher) ──

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const handleSavePayment = async (payload: CreatePaymentRequest) => {
    try {
      setPaymentSaving(true);
      await paymentService.createPayment(payload);
      await refresh(true);
      toast.success(cfg.successMessage);
      setIsPaymentOpen(false);
    } catch (error) {
      toast.error("فشل تسجيل السند: " + error);
    } finally {
      setPaymentSaving(false);
    }
  };

  // ── Rate-map refresh ──

  useEffect(() => {
    if (rateMapKey > 0) refresh(true);
  }, [rateMapKey, refresh]);

  const isLoading = loading || refreshing;

  // ── Detail data (invoices, payments, accounts) ──

  const [accounts, setAccounts] = useState<AccountDto[]>([]);

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await accountingService.getChartOfAccounts());
    } catch (e) { console.error(e); }
  }, []);

  // ── Custom event listener ──

  useEffect(() => {
    const handler = () => handleOpenAdd();
    window.addEventListener(cfg.eventType, handler);
    return () => window.removeEventListener(cfg.eventType, handler);
  }, [cfg.eventType, handleOpenAdd]);

  // ── Return panel state ──

  const [isReturnOpen, setIsReturnOpen] = useState(false);

  // ── Toolbar ──

  const toolbar = (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          const party = selectedItem as CustomerDto | SupplierDto;
          if (party?.account_id) {
            openTab({
              id: `ledger-${party.account_id}`,
              title: `حركة: ${selectedItem?.name}`,
              path: `/accounting/account-ledger/${party.account_id}`,
              closable: true,
            });
          }
        }}
      >
        <History className="w-4 h-4 ml-2 text-slate-500" /> حركة اليومية
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          const tab = cfg.invoicesTab(selectedId!, selectedItem?.name || "");
          openTab(tab);
        }}
      >
        <ShoppingBag className="w-4 h-4 ml-2 text-blue-500" />
        {entityName === "customer" ? "مبيعات العميل" : "مشتريات المورد"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          const tab = cfg.statementPath(selectedId!, selectedItem?.name || "");
          openTab(tab);
        }}
      >
        <Printer className="w-4 h-4 ml-2 text-emerald-500" /> طباعة كشف حساب
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          setIsReturnOpen(true);
          setIsFormOpen(false);
          setIsPaymentOpen(false);
        }}
      >
        <Undo2 className="w-4 h-4 ml-2 text-amber-500" />
        {entityName === "customer" ? "مرتجع مبيعات" : "مرتجع مشتريات"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          setIsPaymentOpen(true);
          setIsFormOpen(false);
        }}
      >
        {entityName === "customer"
          ? <Receipt className="w-4 h-4 ml-2 text-amber-500" />
          : <DollarSign className="w-4 h-4 ml-2 text-rose-500" />
        }
        {entityName === "customer" ? "إنشاء سند قبض" : "إنشاء سند دفع"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        onClick={() => toast.info("جاري التصدير...")}
      >
        <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
      </Button>

      <div className="h-6 w-px bg-slate-200 mx-1" />

      <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
        <Plus className="w-4 h-4 ml-2" /> {cfg.addButtonLabel}
      </Button>
    </div>
  );

  // ── Side panel ──

  const sidePanel = isFormOpen ? (
    <PartnerFormPanel
      type={entityName}
      partner={editItem}
      accounts={accounts}
      onSave={handleSave}
      onClose={() => setIsFormOpen(false)}
      saving={saving}
    />
  ) : isReturnOpen && selectedItem ? (
    <ReturnFromMaterialPanel
      onClose={() => setIsReturnOpen(false)}
      onSaved={() => refresh(true)}
      initialReturnType={cfg.returnReturnType}
      initialPartyId={selectedItem.id}
    />
  ) : isPaymentOpen && selectedItem ? (
    <PaymentForm
      config={cfg.paymentConfig(selectedItem)}
      onSave={handleSavePayment}
      onClose={() => setIsPaymentOpen(false)}
      saving={paymentSaving}
    />
  ) : (
    <PartnerDetailPanel
      type={entityName}
      partner={selectedItem}
      onClose={() => setSelectedId(null)}
      onEdit={(p) => { loadAccounts(); handleOpenEdit(p as CustomerDto | SupplierDto); }}
      onDelete={(id) => { setSelectedId(null); handleDelete(id); }}
      onRefresh={() => refresh(true)}
    />
  );

  return (
    <OperationalTableTemplate
      title={cfg.title}
      toolbar={toolbar}
      tableContent={
        <PartyTable
          entityName={entityName}
          data={items}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
          onView={(item) => setSelectedId(item.id)}
          onEdit={(item) => { loadAccounts(); handleOpenEdit(item); }}
          onDelete={(id) => { setSelectedId(null); handleDelete(id); }}
          onJournal={(item) => {
            const party = item as CustomerDto | SupplierDto;
            if (party.account_id) {
              openTab({
                id: `ledger-${party.account_id}`,
                title: `حركة: ${item.name}`,
                path: `/accounting/account-ledger/${party.account_id}`,
                closable: true,
              });
            }
          }}
          onDocument={(item) => { setSelectedId(item.id); setIsPaymentOpen(true); setIsFormOpen(false); }}
          selectedId={selectedId}
        />
      }
      sidePanel={sidePanel}
      isPanelOpen={isFormOpen || isReturnOpen || isPaymentOpen || !!selectedId}
    />
  );
}
