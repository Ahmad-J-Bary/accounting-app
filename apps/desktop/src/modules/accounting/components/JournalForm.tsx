import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Plus, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { formatCurrency } from '@shared/lib/format';
import type { CreateJournalEntryRequest, JournalType } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { JOURNAL_TYPES } from "@modules/accounting/lib/journal-config";

interface JournalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CreateJournalEntryRequest) => Promise<void>;
  saving: boolean;
  inline?: boolean;
}

export function JournalForm({ open, onOpenChange, onSave, saving, inline }: JournalFormProps) {
  const [form, setForm] = useState<Partial<CreateJournalEntryRequest>>({
    entry_number: "",
    entry_date: new Date().toISOString(),
    description: "",
    journal_type: 'GeneralJournal',
  });

  const [lines, setLines] = useState<{account_id: string, partner_id: string, desc: string, currency: string, fx_rate: number, debit: number, credit: number}[]>([]);

  useEffect(() => {
    if (open) {
      setForm({
        entry_number: "",
        entry_date: new Date().toISOString(),
        description: "",
        journal_type: 'GeneralJournal',
      });
      setLines([
        { account_id: "", partner_id: "", desc: "", currency: "SYP", fx_rate: 1, debit: 0, credit: 0 },
        { account_id: "", partner_id: "", desc: "", currency: "SYP", fx_rate: 1, debit: 0, credit: 0 },
      ]);
    }
  }, [open]);

  const totalBaseDebit = lines.reduce((s, l) => s + (l.debit * l.fx_rate), 0);
  const totalBaseCredit = lines.reduce((s, l) => s + (l.credit * l.fx_rate), 0);
  const balanced = Math.abs(totalBaseDebit - totalBaseCredit) < 0.01 && (totalBaseDebit > 0 || totalBaseCredit > 0);

  const handleAddLine = () => {
    setLines([...lines, { account_id: "", partner_id: "", desc: "", currency: "SYP", fx_rate: 1, debit: 0, credit: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!balanced) return;
    const request: CreateJournalEntryRequest = {
      entry_number: form.entry_number || "",
      journal_type: form.journal_type || 'GeneralJournal',
      entry_date: form.entry_date || new Date().toISOString(),
      description: form.description || "",
      lines: lines.map(l => ({
        account_id: l.account_id,
        partner_id: l.partner_id || undefined,
        currency: l.currency,
        fx_rate: String(l.fx_rate),
        description: l.desc,
        debit: String(l.debit),
        credit: String(l.credit)
      }))
    };
    await onSave(request);
  };

  const formContent = (
    <div className={cn(inline ? "flex flex-col gap-6" : "space-y-6")}>
      {!inline && (
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">إنشاء قيد يومية جديد</DialogTitle>
          <DialogDescription className="text-slate-500">أدخل تفاصيل القيد والحسابات المدينة والدائنة لضمان توازن القيد قبل الترحيل.</DialogDescription>
        </DialogHeader>
      )}
      <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100", inline && "bg-white shadow-sm")}>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">نوع اليومية</Label>
          <Select value={form.journal_type} onValueChange={v => setForm(f => ({ ...f, journal_type: v as JournalType }))}>
            <SelectTrigger className="h-10 bg-white shadow-sm border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOURNAL_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">رقم القيد</Label>
          <Input 
            value={form.entry_number || "تلقائي"} 
            disabled
            className="h-10 bg-slate-50 shadow-sm border-slate-200 font-bold tabular-nums text-center text-slate-500 cursor-not-allowed"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">التاريخ</Label>
          <Input 
            type="date" 
            value={form.entry_date?.slice(0, 10)} 
            onChange={e => setForm(f => ({ ...f, entry_date: new Date(e.target.value).toISOString() }))} 
            className="h-10 bg-white shadow-sm border-slate-200 tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">البيان العام</Label>
        <Textarea 
          placeholder="وصف القيد المحاسبي..." 
          rows={2} 
          value={form.description} 
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
          className="bg-white shadow-sm border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
        />
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-right px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-tighter">الحساب</th>
              <th className="text-right px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-tighter">الطرف المقابل</th>
              <th className="text-right px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-tighter">البيان</th>
              <th className="text-right px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-tighter w-24">العملة</th>
              <th className="text-right px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-tighter w-24">صرف</th>
              <th className="text-left px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-tighter w-32">مدين</th>
              <th className="text-left px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-tighter w-32">دائن</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2">
                  <Input 
                    value={l.account_id} 
                    onChange={e => { 
                      const newLines = [...lines]; 
                      newLines[i].account_id = e.target.value; 
                      setLines(newLines); 
                    }} 
                    placeholder="معرف الحساب"
                    className="h-9 text-[11px] font-bold"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input 
                    value={l.partner_id} 
                    onChange={e => { 
                      const newLines = [...lines]; 
                      newLines[i].partner_id = e.target.value; 
                      setLines(newLines); 
                    }} 
                    placeholder="معرف الطرف"
                    className="h-9 text-[11px]"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input 
                    value={l.desc} 
                    onChange={e => { const newLines = [...lines]; newLines[i].desc = e.target.value; setLines(newLines); }} 
                    placeholder="وصف الحركة" 
                    className="h-9 text-[11px]" 
                  />
                </td>
                <td className="px-3 py-2">
                  <Select value={l.currency} onValueChange={v => {
                    const newLines = [...lines];
                    newLines[i].currency = v;
                    newLines[i].fx_rate = v === "USD" ? 15000 : 1;
                    setLines(newLines);
                  }}>
                    <SelectTrigger className="h-9 text-[11px] font-bold"><SelectValue /></SelectTrigger>
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
                  }} className="h-9 text-[11px] tabular-nums" disabled={l.currency === "SYP"} />
                </td>
                <td className="px-3 py-2">
                  <Input 
                    type="number" 
                    value={l.debit || ""} 
                    onChange={e => { 
                      const newLines = [...lines]; 
                      const val = parseFloat(e.target.value) || 0;
                      newLines[i].debit = val; 
                      if (val > 0) newLines[i].credit = 0;
                      setLines(newLines); 
                    }} 
                    disabled={l.credit > 0}
                    className="h-9 text-left tabular-nums font-black text-blue-700 bg-blue-50/30" 
                  />
                </td>
                <td className="px-3 py-2">
                  <Input 
                    type="number" 
                    value={l.credit || ""} 
                    onChange={e => { 
                      const newLines = [...lines]; 
                      const val = parseFloat(e.target.value) || 0;
                      newLines[i].credit = val; 
                      if (val > 0) newLines[i].debit = 0;
                      setLines(newLines); 
                    }} 
                    disabled={l.debit > 0}
                    className="h-9 text-left tabular-nums font-black text-emerald-700 bg-emerald-50/30" 
                  />
                </td>
                <td className="px-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500" onClick={() => handleRemoveLine(i)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right text-xs text-slate-500 uppercase">إجمالي الحركة (بالعملة الأساسية)</td>
              <td className="px-4 py-3 text-left tabular-nums text-blue-700">{formatCurrency(totalBaseDebit)}</td>
              <td className="px-4 py-3 text-left tabular-nums text-emerald-700">{formatCurrency(totalBaseCredit)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={handleAddLine} className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50">
          <Plus className="w-4 h-4 ml-2" />إضافة سطر محاسبي
        </Button>

        <div className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-xl transition-all shadow-sm border",
          balanced ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
        )}>
          {balanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5 animate-pulse" />}
          <span className="text-sm font-black uppercase tracking-tight">
            {balanced ? "القيد متوازن" : `غير متوازن - الفرق: ${formatCurrency(Math.abs(totalBaseDebit - totalBaseCredit))}`}
          </span>
        </div>
      </div>
      
      {inline ? (
        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button 
            disabled={!balanced || saving} 
            onClick={handleSave}
            className="px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-black h-11"
          >
            {saving ? "جاري الحفظ..." : "تسجيل وترحيل القيد"}
          </Button>
        </div>
      ) : (
        <DialogFooter className="mt-8 pt-6 border-t border-slate-100">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-500 font-bold">إلغاء</Button>
          <Button 
            disabled={!balanced || saving} 
            onClick={handleSave}
            className="px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-black h-11"
          >
            {saving ? "جاري الحفظ..." : "تسجيل وترحيل القيد"}
          </Button>
        </DialogFooter>
      )}
    </div>
  );

  if (inline) {
    return formContent;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" dir="rtl">
        {formContent}
      </DialogContent>
    </Dialog>
  );
}

