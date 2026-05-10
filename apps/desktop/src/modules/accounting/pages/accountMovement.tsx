import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTabs } from "@app/providers/TabContext";
import { Button } from "@shared/ui/button";
import { ArrowRight, RefreshCw, FileText, Download, Printer, Filter, Calculator, Calendar } from "lucide-react";
import { accountingService } from "@modules/accounting/api/accountingService";
import type { AccountLedgerDto, AccountLedgerLineDto } from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { AccountMovementTable } from "../components/AccountMovementTable";
import { Card, CardContent } from "@shared/ui/card";
import { cn } from "@shared/lib/utils";
import { useDataTable } from "@shared/hooks";

export default function AccountMovement() {
  const { accountId } = useParams<{ accountId: string }>();
  const { closeTab, activeTabId } = useTabs();
  const [ledger, setLedger] = useState<AccountLedgerDto | null>(null);

  const {
    loading,
    refreshing,
    refresh,
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

  const stats = useMemo(() => {
    if (!ledger) return null;
    return [
      {
        label: "الرصيد الافتتاحي (ل.س)",
        value: `${parseFloat(ledger.opening_balance_syp).toLocaleString()} ل.س`,
        color: "text-slate-600"
      },
      {
        label: "إجمالي مدين (ل.س)",
        value: `${parseFloat(ledger.total_debit_syp).toLocaleString()} ل.س`,
        color: "text-blue-600"
      },
      {
        label: "إجمالي دائن (ل.س)",
        value: `${parseFloat(ledger.total_credit_syp).toLocaleString()} ل.س`,
        color: "text-emerald-600"
      },
      {
        label: "الرصيد الحالي (ل.س)",
        value: `${parseFloat(ledger.closing_balance_syp).toLocaleString()} ل.س`,
        color: "text-slate-900 font-black",
        highlight: true
      }
    ];
  }, [ledger]);

  return (
    <OperationalTableTemplate
      title={`حركة اليومية للحساب: ${ledger?.account_name || "..."}`}
      toolbar={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => closeTab(activeTabId)}>
            <ArrowRight className="w-4 h-4 ml-2" />
            إغلاق
          </Button>
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading || refreshing}>
            <RefreshCw className={cn("w-4 h-4 ml-2", (loading || refreshing) && "animate-spin")} />
            تحديث
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="w-4 h-4 ml-2" />
            طباعة
          </Button>
          <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-4 h-4 ml-2" />
            تصدير Excel
          </Button>
        </div>
      }
      filterBar={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
             {/* Stats summary in filter bar area for high density */}
             {stats?.map((s, i) => (
               <div key={i} className="flex flex-col border-l last:border-0 border-slate-200 pl-4">
                 <span className="text-[10px] text-slate-500 font-bold">{s.label}</span>
                 <span className={cn("text-xs font-black tabular-nums", s.color)}>{s.value}</span>
               </div>
             ))}
          </div>
          
          <div className="flex items-center gap-2">
             <Button variant="outline" size="sm" className="h-8">
               <Calendar className="w-3.5 h-3.5 ml-1" />
               تصفية بالتاريخ
             </Button>
             <Button variant="outline" size="sm" className="h-8">
               <Filter className="w-3.5 h-3.5 ml-1" />
               خيارات إضافية
             </Button>
          </div>
        </div>
      }
      tableContent={
        <div className="space-y-4 p-4">
          {/* USD Summary Cards for multi-currency tracking */}
          {ledger && (parseFloat(ledger.total_debit_usd) > 0 || parseFloat(ledger.total_credit_usd) > 0) && (
            <div className="grid grid-cols-4 gap-4 mb-4">
               <Card className="bg-blue-50/30 border-blue-100">
                 <CardContent className="p-3">
                   <div className="text-[10px] font-bold text-blue-600 mb-1">إجمالي مدين ($)</div>
                   <div className="text-sm font-black text-blue-800">{parseFloat(ledger.total_debit_usd).toLocaleString()} $</div>
                 </CardContent>
               </Card>
               <Card className="bg-emerald-50/30 border-emerald-100">
                 <CardContent className="p-3">
                   <div className="text-[10px] font-bold text-emerald-600 mb-1">إجمالي دائن ($)</div>
                   <div className="text-sm font-black text-emerald-800">{parseFloat(ledger.total_credit_usd).toLocaleString()} $</div>
                 </CardContent>
               </Card>
               <Card className="bg-slate-50 border-slate-200">
                 <CardContent className="p-3">
                   <div className="text-[10px] font-bold text-slate-600 mb-1">الرصيد الختامي ($)</div>
                   <div className="text-sm font-black text-slate-900">{parseFloat(ledger.closing_balance_usd).toLocaleString()} $</div>
                 </CardContent>
               </Card>
            </div>
          )}

          <AccountMovementTable
            lines={ledger?.lines || []}
            loading={loading}
          />
        </div>
      }
    />
  );
}


