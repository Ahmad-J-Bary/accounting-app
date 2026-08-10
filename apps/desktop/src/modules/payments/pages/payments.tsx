import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@shared/ui/button";
import { Plus } from "lucide-react";
import { paymentService } from "@modules/payments/api/paymentService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { accountingService } from "@modules/accounting/api/accountingService";
import type {
  Payment,
  CreatePaymentRequest,
  UpdatePaymentRequest,
  CustomerDto,
  SupplierDto,
  AccountDto,
} from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useDataTable } from "@shared/hooks";
import { queryClient, invalidateAccountingMutationQueries } from "@shared/hooks/queryClient";
import {
  PaymentForm,
  type PaymentFormPayload,
} from "@modules/payments/components/PaymentForm";
import { PaymentDetailPanel } from "@modules/payments/components/PaymentDetailPanel";
import { PaymentsTable } from "@modules/payments/components/PaymentsTable";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export default function PaymentsPage() {
  const {
    formatAmount,
    currencies,
    baseCurrency,
    rateMap,
    toBase,
  } = useCurrencyContext();

  const {
    filtered: payments,
    loading: paymentsLoading,
    search,
    setSearch,
    refresh,
  } = useDataTable<Payment>({
    queryKey: ["payments"],
    fetchData: () => paymentService.listPayments(),
    searchFields: ["customer_name", "supplier_name", "reference", "notes"],
  });

  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialType = searchParams.get("type");
  const initialCustomerId = searchParams.get("customerId");
  const initialSupplierId = searchParams.get("supplierId");
  const initialDrawingsAccountId = searchParams.get("drawingsAccountId");

  const [typeFilter, setTypeFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(!!initialType);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);

  const loadExtras = useCallback(async () => {
    try {
      const [cData, sData, aData] = await Promise.all([
        customerService.list(),
        supplierService.list(),
        accountingService.getChartOfAccounts(),
      ]);
      setCustomers(cData);
      setSuppliers(sData);
      setAccounts(aData);
    } catch {
      toast.error("فشل تحميل البيانات الإضافية");
    }
  }, []);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (
        !confirm(
          "هل أنت متأكد من حذف هذه الحركة؟ سيتم حذف القيد اليومي المرتبط بها نهائياً.",
        )
      )
        return;
      try {
        await paymentService.deletePayment(id);
        toast.success("تم الحذف بنجاح");
        setSelectedPayment(null);
        refresh(true);
        await invalidateAccountingMutationQueries(queryClient);
    } catch (e) {
        toast.error("فشل الحذف: " + e);
      }
    },
    [refresh],
  );

  const handleCreate = useCallback(async (payload: CreatePaymentRequest) => {
    setSaving(true);
    try {
      await paymentService.createPayment(payload);
      setShowDialog(false);
      refresh(true);
      await invalidateAccountingMutationQueries(queryClient);
      toast.success("تم تسجيل الحركة بنجاح");
    } catch (e) {
      toast.error("فشل حفظ الحركة: " + e);
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const handleUpdate = useCallback(async (payload: PaymentFormPayload) => {
    setSaving(true);
    try {
      if (payload.id) {
        await paymentService.updatePayment(payload as UpdatePaymentRequest);
        toast.success("تم التعديل بنجاح");
      } else {
        await handleCreate(payload);
        return;
      }
      setShowDialog(false);
      setSelectedPayment(null);
      refresh(true);
      await invalidateAccountingMutationQueries(queryClient);
    } catch (e) {
      toast.error("فشل التعديل: " + e);
    } finally {
      setSaving(false);
    }
  }, [refresh, handleCreate]);

  const handleRowClick = useCallback((p: Payment) => {
    setSelectedPayment(p);
  }, []);

  const handleEditClick = useCallback((p: Payment) => {
    setSelectedPayment(p);
    setShowDialog(true);
  }, []);

  return (
    <OperationalTableTemplate
      title="السندات المالية"
      toolbar={
        <Button
          size="sm"
          onClick={() => {
            setSelectedPayment(null);
            setShowDialog(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold"
        >
          <Plus className="w-4 h-4 ml-2" /> سند جديد
        </Button>
      }
      tableContent={
        <PaymentsTable
          payments={payments}
          accounts={accounts}
          currencies={currencies}
          baseCurrency={baseCurrency ?? undefined}
          formatAmount={formatAmount}
          toBase={toBase}
          rateMap={rateMap}
          loading={paymentsLoading}
          search={search}
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          selectedId={selectedPayment?.id}
          onRowClick={handleRowClick}
          onEdit={handleEditClick}
          onDelete={handleDelete}
        />
      }
      sidePanel={
        selectedPayment && !showDialog ? (
          <PaymentDetailPanel
            payment={selectedPayment}
            accounts={accounts}
            customers={customers}
            suppliers={suppliers}
            onClose={() => setSelectedPayment(null)}
            onEdit={() => setShowDialog(true)}
            onDelete={() => handleDelete(selectedPayment.id)}
          />
        ) : showDialog ? (
          <PaymentForm
            customers={customers}
            suppliers={suppliers}
            accounts={accounts}
            onSave={handleUpdate}
            onClose={() => {
              setShowDialog(false);
              setSelectedPayment(null);
            }}
            saving={saving}
            initialValues={
              selectedPayment
                ? {
                    ...selectedPayment,
                    amount: parseFloat(selectedPayment.amount),
                    exchange_rate: parseFloat(selectedPayment.exchange_rate),
                  }
                : initialType
                  ? {
                      payment_type: initialType as Payment["payment_type"],
                      customer_id: initialCustomerId || undefined,
                      supplier_id: initialSupplierId || undefined,
                      debit_account_id: initialDrawingsAccountId || undefined,
                    }
                  : undefined
            }
          />
        ) : null
      }
      isPanelOpen={!!selectedPayment || showDialog}
    />
  );
}
