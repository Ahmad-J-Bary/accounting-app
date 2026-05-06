import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { CreateJournalEntryRequest } from "@erp/shared-types";

interface JournalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CreateJournalEntryRequest) => Promise<void>;
  saving: boolean;
}

export function JournalForm({ open, onOpenChange, onSave, saving }: JournalFormProps) {
  const [form, setForm] = useState<Partial<CreateJournalEntryRequest>>({
    entry_number: "",
    entry_date: new Date().toISOString(),
    description: "",
  });

  const [lines, setLines] = useState<{account_id: string, desc: string, currency: string, fx_rate: number, debit: number, credit: number}[]>([]);

  useEffect(() => {
    if (open) {
      setForm({
        entry_number: `JE-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
        entry_date: new Date().toISOString(),
        description: "",
      });
      setLines([
        { account_id: "", desc: "", currency: "SYP", fx_rate: 1, debit: 0, credit: 0 },
        { account_id: "", desc: "", currency: "SYP", fx_rate: 1, debit: 0, credit: 0 },
      ]);
    }
  }, [open]);

  const totalBaseDebit = lines.reduce((s, l) => s + (l.debit * l.fx_rate), 0);
  const totalBaseCredit = lines.reduce((s, l) => s + (l.credit * l.fx_rate), 0);
  const balanced = Math.abs(totalBaseDebit - totalBaseCredit) < 0.01 && (totalBaseDebit > 0 || totalBaseCredit > 0);

  const handleAddLine = () => {
    setLines([...lines, { account_id: "", desc: "", currency: "SYP", fx_rate: 1, debit: 0, credit: 0 }]);
  };

  const handleSave = async () => {
    if (!balanced) return;
    const request: CreateJournalEntryRequest = {
      entry_number: form.entry_number || "",
      entry_date: form.entry_date || new Date().toISOString(),
      description: form.description || "",
      lines: lines.map(l => ({
        account_id: l.account_id,
        currency: l.currency,
        fx_rate: String(l.fx_rate),
        description: l.desc,
        debit: String(l.debit),
        credit: String(l.credit)
      }))
    };
    await onSave(request);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right px-3 py-2 font-medium">الحساب (ID)</th>
                  <th className="text-right px-3 py-2 font-medium">البيان</th>
                  <th className="text-right px-3 py-2 font-medium w-24">العملة</th>
                  <th className="text-right px-3 py-2 font-medium w-24">سعر الصرف</th>
                  <th className="text-left px-3 py-2 font-medium">مدين</th>
                  <th className="text-left px-3 py-2 font-medium">دائن</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Input 
                        value={l.account_id} 
                        onChange={e => { 
                          const newLines = [...lines]; 
                          newLines[i].account_id = e.target.value; 
                          setLines(newLines); 
                        }} 
                        placeholder="معرف الحساب"
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-2"><Input value={l.desc} onChange={e => { const newLines = [...lines]; newLines[i].desc = e.target.value; setLines(newLines); }} placeholder="البيان" className="h-8" /></td>
                    <td className="px-3 py-2">
                      <Select value={l.currency} onValueChange={v => {
                        const newLines = [...lines];
                        newLines[i].currency = v;
                        newLines[i].fx_rate = v === "USD" ? 15000 : 1;
                        setLines(newLines);
                      }}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SYP">SYP</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" value={l.fx_rate} onChange={e => {
                        const newLines = [...lines];
                        newLines[i].fx_rate = parseFloat(e.target.value) || 1;
                        setLines(newLines);
                      }} className="h-8" disabled={l.currency === "SYP"} />
                    </td>
                    <td className="px-3 py-2"><Input type="number" value={l.debit || ""} onChange={e => { const newLines = [...lines]; newLines[i].debit = parseFloat(e.target.value) || 0; setLines(newLines); }} className="h-8 text-left tabular-nums" /></td>
                    <td className="px-3 py-2"><Input type="number" value={l.credit || ""} onChange={e => { const newLines = [...lines]; newLines[i].credit = parseFloat(e.target.value) || 0; setLines(newLines); }} className="h-8 text-left tabular-nums" /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right">الإجمالي (بالعملة الأساسية - ل.س)</td>
                  <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(totalBaseDebit)}</td>
                  <td className="px-3 py-2 text-left tabular-nums">{formatCurrency(totalBaseCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <Button variant="outline" size="sm" onClick={handleAddLine}>
            <Plus className="w-4 h-4 ml-2" />إضافة سطر
          </Button>

          <div className={`flex items-center gap-2 p-3 rounded-md ${balanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {balanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">
              {balanced ? "القيد متوازن ✓" : `القيد غير متوازن - الفرق: ${formatCurrency(Math.abs(totalBaseDebit - totalBaseCredit))}`}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button disabled={!balanced || saving} onClick={handleSave}>
            {saving ? "جاري الحفظ..." : "حفظ القيد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
