import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { CheckCircle2, RotateCcw, Printer, FileText, Link as LinkIcon, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate } from "@shared/lib/format";
import type { JournalEntryDto } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";

interface JournalDetailPanelProps {
  entry: JournalEntryDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPost?: (id: string) => void;
  onReverse?: (id: string) => void;
}

export function JournalDetailPanel({ entry, open, onOpenChange, onPost, onReverse }: JournalDetailPanelProps) {
  if (!entry) return null;

  const isPosted = entry.status === 'Posted';
  const isReversed = entry.status === 'Reversed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="border-b pb-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-black flex items-center gap-3">
                {entry.entry_number}
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border",
                  isPosted ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                  isReversed ? "bg-orange-50 text-orange-700 border-orange-100" :
                  "bg-blue-50 text-blue-700 border-blue-100"
                )}>
                  {isPosted ? "مرحل" : isReversed ? "معكوس" : "مسودة"}
                </span>
              </DialogTitle>
              <p className="text-slate-500 text-sm font-medium">{entry.journal_type_display} - {formatDate(entry.entry_date)}</p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Printer className="w-4 h-4" />طباعة
              </Button>
              {entry.source_id && (
                <Button variant="outline" size="sm" className="h-9 gap-2 border-indigo-100 text-indigo-600 bg-indigo-50/30">
                  <LinkIcon className="w-4 h-4" />المستند المصدر
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
             <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">البيان</label>
                  <p className="text-slate-700 font-bold leading-relaxed">{entry.description}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ الإنشاء</label>
                  <p className="text-slate-600 text-xs tabular-nums font-medium">{formatDate(entry.created_at)}</p>
                </div>
             </div>
             
             <div className="flex flex-col justify-end items-end gap-2">
                <div className="text-right">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي القيد</label>
                   <span className="text-3xl font-black text-slate-900 tabular-nums">
                     {formatCurrency(parseFloat(entry.total_base_debit))}
                   </span>
                </div>
             </div>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-right px-4 py-3 font-black text-slate-600 text-xs uppercase">الحساب</th>
                  <th className="text-right px-4 py-3 font-black text-slate-600 text-xs uppercase">البيان</th>
                  <th className="text-left px-4 py-3 font-black text-slate-600 text-xs uppercase w-32">مدين</th>
                  <th className="text-left px-4 py-3 font-black text-slate-600 text-xs uppercase w-32">دائن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entry.lines.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4">
                       <div className="flex flex-col gap-0.5">
                          <span className="font-black text-slate-900">{l.account_name || "حساب غير معروف"}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{l.account_id}</span>
                          {l.partner_name && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 self-start px-1.5 py-0.5 rounded-md mt-1 font-bold">
                              الطرف: {l.partner_name}
                            </span>
                          )}
                       </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-medium">{l.description}</td>
                    <td className="px-4 py-4 text-left tabular-nums">
                       {parseFloat(l.debit) > 0 ? (
                         <span className="font-black text-blue-700">{formatCurrency(parseFloat(l.debit))}</span>
                       ) : "-"}
                    </td>
                    <td className="px-4 py-4 text-left tabular-nums">
                       {parseFloat(l.credit) > 0 ? (
                         <span className="font-black text-emerald-700">{formatCurrency(parseFloat(l.credit))}</span>
                       ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr className="font-black">
                   <td colSpan={2} className="px-4 py-4 text-right text-slate-500 text-xs uppercase">المجموع</td>
                   <td className="px-4 py-4 text-left text-blue-800 tabular-nums">{formatCurrency(parseFloat(entry.total_base_debit))}</td>
                   <td className="px-4 py-4 text-left text-emerald-800 tabular-nums">{formatCurrency(parseFloat(entry.total_base_credit))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
             {entry.status === 'Draft' && onPost && (
               <Button 
                 onClick={() => onPost(entry.id)}
                 className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-black h-11 px-8 shadow-lg shadow-emerald-100"
               >
                 <CheckCircle2 className="w-4 h-4" />ترحيل القيد
               </Button>
             )}
             {entry.status === 'Posted' && onReverse && (
               <Button 
                 onClick={() => onReverse(entry.id)}
                 variant="outline"
                 className="border-orange-200 text-orange-700 hover:bg-orange-50 gap-2 font-black h-11 px-8"
               >
                 <RotateCcw className="w-4 h-4" />عكس القيد
               </Button>
             )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
