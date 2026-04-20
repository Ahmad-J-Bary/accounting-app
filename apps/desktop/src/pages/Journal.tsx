import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Search, Filter, MoreHorizontal, Eye, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { journalEntries } from "@/lib/mockData";
import { formatCurrency, formatDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Journal() {
  const [createOpen, setCreateOpen] = useState(false);

  const [lines, setLines] = useState([
    { account: "1101 - الصندوق", desc: "", debit: 15000, credit: 0 },
    { account: "4101 - إيرادات المبيعات", desc: "", debit: 0, credit: 15000 },
  ]);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const balanced = totalDebit === totalCredit;

  return (
    <>
      <PageHeader
        title="القيود اليومية"
        subtitle="إدارة القيود المحاسبية اليومية"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المحاسبة" }, { label: "القيود اليومية" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 ml-2" />قيد جديد</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>إنشاء قيد يومية جديد</DialogTitle>
                  <DialogDescription>أدخل تفاصيل القيد والحسابات المدينة والدائنة لضمان توازن القيد قبل الترحيل.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>رقم القيد</Label>
                      <Input defaultValue="JE-2026-0235" disabled />
                    </div>
                    <div>
                      <Label>التاريخ</Label>
                      <Input type="date" defaultValue="2026-04-19" />
                    </div>
                    <div>
                      <Label>المرجع</Label>
                      <Input placeholder="اختياري" />
                    </div>
                  </div>
                  <div>
                    <Label>البيان</Label>
                    <Textarea placeholder="وصف القيد المحاسبي..." rows={2} />
                  </div>

                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-right px-3 py-2 font-medium">الحساب</th>
                          <th className="text-right px-3 py-2 font-medium">البيان</th>
                          <th className="text-left px-3 py-2 font-medium">مدين</th>
                          <th className="text-left px-3 py-2 font-medium">دائن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-3 py-2"><Input defaultValue={l.account} className="h-8" /></td>
                            <td className="px-3 py-2"><Input placeholder="بيان السطر" className="h-8" /></td>
                            <td className="px-3 py-2"><Input type="number" defaultValue={l.debit || ""} className="h-8 text-left tabular-nums" /></td>
                            <td className="px-3 py-2"><Input type="number" defaultValue={l.credit || ""} className="h-8 text-left tabular-nums" /></td>
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

                  <Button variant="outline" size="sm" onClick={() => setLines([...lines, { account: "", desc: "", debit: 0, credit: 0 }])}>
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
                  <Button variant="secondary">حفظ كمسودة</Button>
                  <Button disabled={!balanced}>ترحيل القيد</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث برقم القيد أو البيان..." className="pr-10" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="posted">مُرحّل</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="unbalanced">غير متوازن</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="w-[160px]" />
          <Input type="date" className="w-[160px]" />
          <Button variant="outline"><Filter className="w-4 h-4 ml-2" />تصفية</Button>
        </div>

        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
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
              {journalEntries.map((j) => (
                <tr key={j.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-primary">{j.number}</td>
                  <td className="px-4 py-3">{formatDate(j.date)}</td>
                  <td className="px-4 py-3">{j.description}</td>
                  <td className="px-4 py-3 text-left tabular-nums">{formatCurrency(j.debit)}</td>
                  <td className="px-4 py-3 text-left tabular-nums">{formatCurrency(j.credit)}</td>
                  <td className="px-4 py-3 text-left"><StatusBadge status={j.status} /></td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600"><Trash2 className="w-4 h-4 ml-2" />حذف</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <div>عرض 1 إلى {journalEntries.length} من أصل {journalEntries.length} قيد</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>السابق</Button>
            <Button variant="outline" size="sm" disabled>التالي</Button>
          </div>
        </div>
      </Card>
    </>
  );
}