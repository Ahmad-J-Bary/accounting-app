import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Undo2, DollarSign, Eye, Settings2, Trash2, RefreshCw } from "lucide-react";
import { returnService } from '@modules/invoicing/api/returnService';
import { supplierService } from '@modules/partners/api/supplierService';
import { materialService } from '@modules/inventory/api/materialService';
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import type { SupplierDto, MaterialDto, InvoiceDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useDataTable } from '@shared/hooks';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { ReturnsTable, type ReturnLineRow } from '../components/ReturnsTable';
import { ReturnsForm, type ReturnsFormState, type ReturnLineForm } from '../components/ReturnsForm';

export default function PurchaseReturnsPage() {
  const { formatMonetaryAmount } = useCurrencyContext();
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingInfo, setEditingInfo] = useState<{id: string; returnNumber: string} | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnsFormState>({
    supplier_id: "",
    customer_id: "",
    return_date: new Date().toISOString().slice(0, 10),
    notes: "",
    purchase_invoice_id: "",
    lines: [{ material_id: "", quantity: "1", unit_price: "0", unit_id: "", notes: "", line_total: "0" }],
  });

  const {
    filtered: items,
    loading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<ReturnLineRow>({
    fetchData: async () => {
      const data = await returnService.listPurchaseReturns();
      const safeData = Array.isArray(data) ? data : [];
      return safeData.flatMap(r =>
        (Array.isArray(r.lines) ? r.lines : []).map(l => ({
          return_id: r.id,
          return_number: r.return_number,
          material_name: l.material_name,
          material_id: l.material_id,
          partner_name: r.supplier_name,
          unit_price: l.unit_price,
          quantity: l.quantity,
          unit_id: l.unit_id,
          line_total: l.line_total,
          return_date: r.return_date,
          notes: l.notes,
        }))
      );
    },
    searchFields: ["return_number", "material_name", "partner_name"],
  });

  const loadData = useCallback(async () => {
    try {
      const [s, m, inv] = await Promise.all([
        supplierService.listSuppliers(),
        materialService.listMaterials(),
        invoiceService.listInvoicesByType("Purchase"),
      ]);
      setSuppliers(s);
      setMaterials(m);
      setInvoices(inv);
    } catch { toast.error("فشل تحميل البيانات"); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleView = useCallback(async (returnId: string) => {
    try {
      const ret = await returnService.getPurchaseReturn(returnId);
      setForm({
        supplier_id: ret.supplier_id,
        customer_id: "",
        return_date: ret.return_date.slice(0, 10),
        notes: ret.notes || "",
        purchase_invoice_id: "",
        lines: ret.lines.map(l => ({
          material_id: l.material_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          unit_id: l.unit_id || "",
          notes: l.notes || "",
          line_total: l.line_total,
        })),
      });
      setEditingInfo({ id: returnId, returnNumber: ret.return_number });
      setShowForm(true);
    } catch (e) { toast.error("فشل تحميل المرتجع: " + e); }
  }, []);

  const handleDelete = useCallback(async (returnId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المرتجع؟")) return;
    try {
      await returnService.deletePurchaseReturn(returnId);
      toast.success("تم حذف المرتجع بنجاح");
      setSelectedId(null);
      refresh(true);
    } catch (e) { toast.error("فشل الحذف: " + e); }
  }, [refresh]);

  const handleEdit = useCallback(async (returnId: string) => {
    try {
      const ret = await returnService.getPurchaseReturn(returnId);
      setForm({
        supplier_id: ret.supplier_id,
        customer_id: "",
        return_date: ret.return_date.slice(0, 10),
        notes: ret.notes || "",
        purchase_invoice_id: "",
        lines: ret.lines.map(l => ({
          material_id: l.material_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          unit_id: l.unit_id || "",
          notes: l.notes || "",
          line_total: l.line_total,
        })),
      });
      setEditingInfo({ id: returnId, returnNumber: ret.return_number });
      setShowForm(true);
    } catch (e) { toast.error("فشل تحميل بيانات المرتجع: " + e); }
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingInfo(null);
    setForm({
      supplier_id: "", customer_id: "", return_date: new Date().toISOString().slice(0, 10),
      notes: "", purchase_invoice_id: "", lines: [{ material_id: "", quantity: "1", unit_price: "0", unit_id: "", notes: "", line_total: "0" }],
    });
  }, []);

  const handleSave = async (lines: ReturnLineForm[]) => {
    setSaving(true);
    try {
      const isEditing = !!editingInfo;
      await returnService.createPurchaseReturn({
        id: editingInfo?.id ?? undefined,
        return_number: editingInfo?.returnNumber ?? "",
        supplier_id: form.supplier_id,
        return_date: new Date(form.return_date).toISOString(),
        lines: lines.map(l => ({ ...l, id: "" })),
        notes: form.notes || undefined,
      });
      handleCloseForm();
      refresh(true);
      toast.success(isEditing ? "تم تحديث مرتجع المشتريات بنجاح" : "تم تسجيل مرتجع المشتريات بنجاح");
    } catch (e) { toast.error("فشل الحفظ: " + e); }
    finally { setSaving(false); }
  };

  const totalAmount = useMemo(() =>
    items.reduce((s: number, r: ReturnLineRow) => s + parseFloat(r.line_total || "0"), 0),
  [items]);

  const stats = useMemo(() => [
    { label: "إجمالي المرتجعات", value: items.length, icon: Undo2, color: "text-amber-600" },
    { label: "إجمالي المبلغ", value: formatMonetaryAmount(totalAmount, "base"), icon: DollarSign, color: "text-green-600" },
  ], [items.length, totalAmount, formatMonetaryAmount]);

  return (
    <OperationalTableTemplate
      title="مرتجعات المشتريات"
      stats={stats}
      toolbar={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowForm(true)} className="bg-amber-600 hover:bg-amber-700 font-bold">
            <Plus className="w-4 h-4 ml-2" /> مرتجع مشتريات جديد
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => selectedId && handleView(selectedId)}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Eye className="w-4 h-4 ml-2 text-blue-500" /> عرض
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => selectedId && handleEdit(selectedId)}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Settings2 className="w-4 h-4 ml-2 text-amber-500" /> تعديل
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedId}
            onClick={() => selectedId && handleDelete(selectedId)}
            className="h-9 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 font-bold transition-all">
            <Trash2 className="w-4 h-4 ml-2 text-rose-500" /> حذف
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <Button variant="outline" size="sm"
            onClick={() => refresh(true)}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <RefreshCw className="w-4 h-4 ml-2 text-slate-500" /> تحديث
          </Button>
        </div>
      }
      tableContent={
        <ReturnsTable
          items={items}
          loading={loading || refreshing}
          search={search}
          onSearchChange={setSearch}
          materials={materials}
          partnerLabel="المورد"
          emptyMessage="لا توجد مرتجعات مشتريات"
          selectedId={selectedId}
          onSelect={setSelectedId}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      }
      sidePanel={
        showForm ? (
          <ReturnsForm
            type="purchase"
            onClose={handleCloseForm}
            onSave={handleSave}
            saving={saving}
            suppliers={suppliers}
            materials={materials}
            invoices={invoices}
            form={form}
            setForm={setForm}
          />
        ) : null
      }
      isPanelOpen={showForm}
    />
  );
}
