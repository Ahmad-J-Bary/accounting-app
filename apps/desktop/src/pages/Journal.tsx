import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Search, Filter, MoreHorizontal, Eye, Trash2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { journalEntryService } from "@/services/journalEntryService";
import type { JournalEntryDto, CreateJournalEntryRequest } from "@erp/shared-types";

export default function Journal() {
  const [createOpen, setCreateOpen] = useState(false);
  const [entries, setEntries] = useState<JournalEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Partial<CreateJournalEntryRequest>>({
    entry_number: `JE-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
    entry_date: new Date().toISOString(),
    description: "",
  });

  // Using dummy valid UUIDs for initial lines to prevent UUID parse errors on backend
  const [lines, setLines] = useState<{account_id: string, desc: string, debit: number, credit: number}[]>([
    { account_id: crypto.randomUUID?.() || "00000000-0000-0000-0000-000000000001", desc: "", debit: 15000, credit: 0 },
    { account_id: crypto.randomUUID?.() || "00000000-0000-0000-0000-000000000002", desc: "", debit: 0, credit: 15000 },
  ]);

  const load = async () => {
    setLoading(true);
    try {
      setEntries(await journalEntryService.listJournalEntries());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  const handleCreate = async () => {
    if (!balanced) return;
    if (!form.description?.trim()) {
      setError("الرجاء إدخال رقم القيد والبيان");
      return;
    }
    setSaving(true);
    try {
      const request: CreateJournalEntryRequest = {
        entry_number: form.entry_number || "",
        entry_date: form.entry_date || new Date().toISOString(),
        description: form.description || "",
        lines: lines.map(l => ({
          account_id: l.account_id || "00000000-0000-0000-0000-000000000000",
          description: l.desc,
          debit: String(l.debit),
          credit: String(l.credit)
        }))
      };
      await journalEntryService.createJournalEntry(request);
      setCreateOpen(false);
      await load();
      // Reset form
      setForm({
        entry_number: `JE-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
        entry_date: new Date().toISOString(),
        description: "",
      });
      setLines([
        { account_id: crypto.randomUUID?.() || "00000000-0000-0000-0000-000000000001", desc: "", debit: 0, credit: 0 },
        { account_id: crypto.randomUUID?.() || "00000000-0000-0000-0000-000000000002", desc: "", debit: 0, credit: 0 },
      ]);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (id: string) => {
    if (!confirm('هل أنت متأكد من ترحيل القيد؟ لا يمكن التعديل بعد الترحيل.')) return;
    try {
      await journalEntryService.postJournalEntry(id);
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <>
      <PageHeader
        title="القيود اليومية"
        subtitle="إدارة القيود المحاسبية اليومية"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المحاسبة" }, { label: "القيود اليومية" }]}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 ml-2" />قيد جديد</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إنشاء قيد يومية جديد</DialogTitle>
                  <DialogDescription>أدخل تفاصيل القيد والحسابات المدينة والدائنة لضمان توازن القيد قبل الترحيل.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label>رقم القيد</Label>
                      <Input value={form.entry_number} onChange={e => setForm(f => ({ ...f, entry_number: e.target.value }))} />
                    </div>
                    <div>
                      <Label>التاريخ</Label>
                      <Input type="date" value={form.entry_date?.slice(0, 10)} onChange={e => setForm(f => ({ ...f, entry_date: new Date(e.target.value).toISOString() }))} />
                    </div>
                  </div>
                  <div>
                    <Label>البيان</Label>
                    <Textarea placeholder="وصف القيد المحاسبي..." rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>

                  <div className="border border-border rounded-md overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-right px-3 py-2 font-medium">رقم الحساب (ID)</th>
                          <th className="text-right px-3 py-2 font-medium">البيان</th>
                          <th className="text-left px-3 py-2 font-medium">مدين</th>
                          <th className="text-left px-3 py-2 font-medium">دائن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-3 py-2"><Input value={l.account_id} onChange={e => { const newLines = [...lines]; newLines[i].account_id = e.target.value; setLines(newLines); }} className="h-8" /></td>
                            <td className="px-3 py-2"><Input value={l.desc} onChange={e => { const newLines = [...lines]; newLines[i].desc = e.target.value; setLines(newLines); }} placeholder="بيان السطر" className="h-8" /></td>
                            <td className="px-3 py-2"><Input type="number" value={l.debit || ""} onChange={e => { const newLines = [...lines]; newLines[i].debit = parseFloat(e.target.value) || 0; setLines(newLines); }} className="h-8 text-left tabular-nums" /></td>
                            <td className="px-3 py-2"><Input type="number" value={l.credit || ""} onChange={e => { const newLines = [...lines]; newLines[i].credit = parseFloat(e.target.value) || 0; setLines(newLines); }} className="h-8 text-left tabular-nums" /></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-right">الإجمالي</td>
                          <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(totalDebit)}</td>
                          <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(totalCredit)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <Button variant="outline" size="sm" onClick={() => setLines([...lines, { account_id: crypto.randomUUID?.() || "00000000-0000-0000-0000-000000000000", desc: "", debit: 0, credit: 0 }])}>
                    <Plus className="w-4 h-4 ml-2" />إضافة سطر
                  </Button>

                  <div className={`flex items-center gap-2 p-3 rounded-md ${balanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {balanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-medium">
                      {balanced ? "القيد متوازن ✓" : `القيد غير متوازن - الفرق: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
                  <Button disabled={!balanced || saving} onClick={handleCreate}>
                    {saving ? "جاري الحفظ..." : "حفظ القيد"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error} <button className="mr-2 underline" onClick={() => setError(null)}>إغلاق</button>
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث برقم القيد أو البيان..." className="pr-10" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : entries.length === 0 ? (
           <div className="text-center py-12 text-muted-foreground">لا توجد قيود يومية</div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">رقم القيد</th>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium">البيان</th>
                  <th className="text-left px-4 py-3 font-medium">مدين</th>
                  <th className="text-left px-4 py-3 font-medium">دائن</th>
                  <th className="text-left px-4 py-3 font-medium">الحالة</th>
                  <th className="text-left px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((j) => (
                  <tr key={j.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-primary">{j.entry_number}</td>
                    <td className="px-4 py-3">{formatDate(j.entry_date)}</td>
                    <td className="px-4 py-3">{j.description}</td>
                    <td className="px-4 py-3 text-left tabular-nums">{formatCurrency(parseFloat(j.total_debit))}</td>
                    <td className="px-4 py-3 text-left tabular-nums">{formatCurrency(parseFloat(j.total_credit))}</td>
                    <td className="px-4 py-3 text-left"><StatusBadge status={j.status} /></td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                          {j.status !== "Posted" && (
                            <DropdownMenuItem onClick={() => handlePost(j.id)}><CheckCircle2 className="w-4 h-4 ml-2" />ترحيل</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}