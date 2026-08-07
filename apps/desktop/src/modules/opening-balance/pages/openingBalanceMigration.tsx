import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw, CheckCircle2, Coins } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { toast } from "sonner";
import type { AccountDto } from "@erp/shared-types";
import { accountingService } from "@modules/accounting/api/accountingService";
import {
  openingBalanceService,
  type OpeningBalanceMigrationDto,
  type OpeningLineInput,
  type NetProfitAllocationDto,
} from "@modules/accounting/api/openingBalanceService";

interface AccountLine {
  key: string;
  account_id: string;
  amount: string;
  description: string;
}

const TYPE_LABEL: Record<string, string> = {
  Assets: "أصل",
  Liabilities: "التزام",
  Equity: "حقوق ملكية",
  Revenue: "إيراد",
  Expenses: "مصروف",
};

const STATUS_LABEL: Record<string, string> = {
  Draft: "مسودة",
  Posted: "مرحّل",
  Cancelled: "ملغى",
};

function isDebitNature(accountType: string): boolean {
  return accountType === "Assets" || accountType === "Expenses";
}

export default function OpeningBalanceMigration() {
  const [cutoverDate, setCutoverDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<AccountLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [allocMigrationId, setAllocMigrationId] = useState<string>("");
  const [netProfit, setNetProfit] = useState("");
  const [allocResult, setAllocResult] = useState<NetProfitAllocationDto | null>(null);
  const [allocating, setAllocating] = useState(false);

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: ["chart-of-accounts"],
    queryFn: () => accountingService.getChartOfAccounts(),
  });

  const {
    data: migrations = [],
    refetch: refetchMigrations,
    isLoading,
  } = useQuery<OpeningBalanceMigrationDto[]>({
    queryKey: ["opening-balance-migrations"],
    queryFn: () => openingBalanceService.listMigrations(),
  });

  const detailAccounts = useMemo(
    () => accounts.filter((a) => a.category === "Detail" && a.is_active),
    [accounts],
  );

  const addLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { key: `ob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, account_id: "", amount: "", description: "" },
    ]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<AccountLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const { debitTotal, creditTotal, isValid } = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      const acc = accounts.find((a) => a.id === l.account_id);
      const amount = parseFloat(l.amount) || 0;
      if (!acc || !amount) continue;
      if (isDebitNature(acc.account_type)) debit += amount;
      else credit += amount;
    }
    return { debitTotal: debit, creditTotal: credit, isValid: debit === credit };
  }, [lines, accounts]);

  const handleCreate = async () => {
    if (!cutoverDate) return toast.error("اختر تاريخ الترحيل");
    const validLines = lines.filter((l) => l.account_id && l.amount);
    if (validLines.length === 0) return toast.error("أضف بنداً واحداً على الأقل مع الحساب والمبلغ");
    setSaving(true);
    try {
      const payload = {
        cutover_date: new Date(cutoverDate).toISOString(),
        notes: notes || null,
        lines: validLines.map((l): OpeningLineInput => ({
          account_id: l.account_id,
          amount: l.amount,
          description: l.description || undefined,
        })),
      };
      await openingBalanceService.createMigration(payload);
      toast.success("تم حفظ مسودة الترحيل");
      setLines([]);
      setNotes("");
      refetchMigrations();
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (id: string) => {
    setPostingId(id);
    try {
      const res = await openingBalanceService.postMigration(id);
      toast.success(
        (res.equity_balanced ? "تم ترحيل الرصيد الافتتاحي (متوازن)" : "تم الترحيل مع تسوية على رصيد الافتتاح")
          + ` — مدين ${res.debit_total} / دائن ${res.credit_total}`
      );
      refetchMigrations();
    } catch (e) {
      toast.error("فشل الترحيل: " + e);
    } finally {
      setPostingId(null);
    }
  };

  const postedMigrations = useMemo(
    () => migrations.filter((m) => m.status === "Posted"),
    [migrations],
  );

  const handleAllocate = async () => {
    if (!allocMigrationId) return toast.error("اختر ترحيلاً مرحّلاً");
    if (!netProfit || isNaN(parseFloat(netProfit))) return toast.error("أدخل صافي الربح");
    setAllocating(true);
    setAllocResult(null);
    try {
      const res = await openingBalanceService.allocateNetProfit({
        migration_id: allocMigrationId,
        net_profit: netProfit,
      });
      setAllocResult(res);
      toast.success("تم توزيع أرباح الترحيل على الشركاء");
      refetchMigrations();
    } catch (e) {
      toast.error("فشل توزيع الأرباح: " + e);
    } finally {
      setAllocating(false);
    }
  };

  return (
    <OperationalTableTemplate
      title="رصيد افتتاح الشركة (شركة قائمة)"
      toolbar={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchMigrations()} className="border-slate-200 hover:bg-slate-50 font-bold">
            <RefreshCw className="w-4 h-4 ml-2 text-slate-500" /> تحديث
          </Button>
        </div>
      }
      tableContent={
        <div className="flex flex-col h-full overflow-auto p-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-bold text-slate-800">إنشاء مسودة رصيد افتتاحي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">تاريخ الترحيل (Cutover)</label>
                  <Input type="date" value={cutoverDate} onChange={(e) => setCutoverDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">ملاحظات</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات اختيارية..." className="h-9" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">بنود الرصيد الافتتاحي</span>
                  <Button size="sm" variant="outline" onClick={addLine} className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
                    <Plus className="w-3.5 h-3.5 ml-1.5" /> إضافة بند
                  </Button>
                </div>

                {lines.length === 0 && (
                  <p className="text-xs text-slate-400 py-2 text-center">لا توجد بنود بعد — أضف الحسابات وأرصدتها</p>
                )}

                {lines.map((l) => {
                  const acc = accounts.find((a) => a.id === l.account_id);
                  return (
                    <div key={l.key} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
                      <Input
                        list="ob-accounts"
                        value={l.account_id}
                        onChange={(e) => updateLine(l.key, { account_id: e.target.value })}
                        placeholder="ابحث واختر حساباً..."
                        className="h-9 flex-1"
                      />
                      <div className="w-[190px] shrink-0 text-xs text-slate-600">
                        {acc ? `${acc.name_ar} (${TYPE_LABEL[acc.account_type]})` : "—"}
                      </div>
                      <div className="w-[90px] shrink-0 text-[11px] font-bold text-slate-500">
                        {acc && isDebitNature(acc.account_type) ? "مدين" : acc ? "دائن" : ""}
                      </div>
                      <Input
                        value={l.amount}
                        onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                        placeholder="0.00"
                        className="h-9 w-[110px] shrink-0 text-left tabular-nums"
                      />
                      <Button size="sm" variant="ghost" onClick={() => removeLine(l.key)} className="text-red-500 hover:bg-red-50">حذف</Button>
                    </div>
                  );
                })}

                <datalist id="ob-accounts">
                  {detailAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name_ar} ({TYPE_LABEL[a.account_type]})
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="text-xs font-semibold flex gap-4 text-slate-600">
                  <span className={isValid ? "text-green-600" : "text-red-500"}>
                    مدين: {debitTotal.toFixed(2)}
                  </span>
                  <span className={isValid ? "text-green-600" : "text-red-500"}>
                    دائن: {creditTotal.toFixed(2)}
                  </span>
                  <span className={isValid ? "text-green-600" : "text-red-500"}>
                    {isValid ? "متوازن ✓" : "غير متوازن"}
                  </span>
                </div>
                <Button onClick={handleCreate} disabled={saving || !isValid} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-bold">
                  {saving ? "جارٍ الحفظ..." : "حفظ المسودة"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-bold text-slate-800">ترحيلات الرصيد الافتتاحي</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading && <p className="text-xs text-slate-400 p-4">جارٍ التحميل...</p>}
              {migrations.length === 0 && !isLoading && (
                <p className="text-xs text-slate-400 p-4 text-center">لا توجد ترحيلات بعد</p>
              )}
              <div className="divide-y divide-slate-100">
                {migrations.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-700">
                        {m.cutover_date.split("T")[0]} — {m.lines.length} بنود
                        <span
                          className={
                            "mr-2 text-xs px-2 py-0.5 rounded-full " +
                            (m.status === "Posted" ? "bg-green-100 text-green-700"
                              : m.status === "Cancelled" ? "bg-red-100 text-red-600"
                                : "bg-amber-100 text-amber-700")
                          }
                        >
                          {STATUS_LABEL[m.status]}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 truncate">{m.notes || "بدون ملاحظات"}</div>
                    </div>
                    {m.status === "Draft" && (
                      <Button
                        size="sm"
                        disabled={postingId === m.id}
                        onClick={() => handlePost(m.id)}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" /> {postingId === m.id ? "جارٍ..." : "ترحيل"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Coins className="w-4 h-4 text-blue-600" /> توزيع صافي الربح على الشركاء
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">
                أدخل صافي الربح (نتيجة قائمة الدخل) حتى تاريخ القطع لتوزيعه على حسابات رأس مال الشركاء (51X).
              </p>
              <div className="grid grid-cols-[1fr_180px_auto] gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">الترحيل المرحّل</label>
                  <Select value={allocMigrationId} onValueChange={setAllocMigrationId}>
                    <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder={postedMigrations.length ? "اختر ترحيلاً..." : "لا توجد ترحيلات مرحّلة"} />
                    </SelectTrigger>
                    <SelectContent>
                      {postedMigrations.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.cutover_date.split("T")[0]} — {m.notes || "بدون ملاحظات"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">صافي الربح</label>
                  <Input value={netProfit} onChange={(e) => setNetProfit(e.target.value)} placeholder="0.00" type="number" className="h-9 text-left tabular-nums" />
                </div>
                <div className="flex items-end">
                  <Button size="sm" onClick={handleAllocate} disabled={allocating} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {allocating ? "جارٍ التوزيع..." : "توزيع"}
                  </Button>
                </div>
              </div>

              {allocResult && (
                <div className="border border-green-200 bg-green-50 rounded-lg p-3 space-y-2">
                  <div className="text-xs font-semibold text-green-700">
                    رقم القيد: {allocResult.entry_number} — الموزع:
                    {parseFloat(allocResult.allocated_total || "0").toFixed(2)} من {parseFloat(allocResult.net_profit || "0").toFixed(2)}
                  </div>
                  {allocResult.shares.length === 0 && (
                    <p className="text-xs text-slate-500">لا توجد حصص (صافي الربح صفر).</p>
                  )}
                  <div className="divide-y divide-green-100">
                    {allocResult.shares.map((s) => (
                      <div key={s.partner_id} className="flex items-center justify-between py-1 text-xs text-slate-700">
                        <span className="font-semibold">{s.partner_name}</span>
                        <span className="text-slate-400">رأس المال {parseFloat(s.capital || "0").toFixed(2)} · نسبة {parseFloat(s.ratio_percent || "0").toFixed(2)}%</span>
                        <span className="font-bold tabular-nums">{parseFloat(s.share || "0").toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      }
    />
  );
}