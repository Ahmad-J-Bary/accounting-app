import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableFooter,
  TableHead, 
  TableHeader, 
  TableRow 
} from "@shared/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@shared/ui/card";
import { journalEntryService } from "../../accounting/api/journalEntryService";
import type { JournalEntryDto } from "@erp/shared-types";
import { format } from "date-fns";
import { Loader2, FileText, ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@shared/ui/button";

import { useMemo } from 'react';

interface SupplierStatementProps {
  partnerId: string;
  partnerName: string;
}

export const SupplierStatement: React.FC<SupplierStatementProps> = ({ partnerId, partnerName }) => {
  const [entries, setEntries] = useState<JournalEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        setLoading(true);
        const data = await journalEntryService.listJournalEntries({ partner_id: partnerId });
        const sorted = data.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
        setEntries(sorted);
      } catch (err) {
        console.error("Failed to fetch statement:", err);
        setError("فشل تحميل كشف الحساب");
      } finally {
        setLoading(false);
      }
    };

    if (partnerId) {
      fetchStatement();
    }
  }, [partnerId]);

  const totals = useMemo(() => {
    let debitUSD = 0, creditUSD = 0;
    let debitSYP = 0, creditSYP = 0;

    entries.forEach(entry => {
      const partnerLines = entry.lines.filter(l => l.partner_id === partnerId);
      partnerLines.forEach(line => {
        const d = parseFloat(line.debit || "0");
        const c = parseFloat(line.credit || "0");
        if (line.currency === 'USD') {
          debitUSD += d;
          creditUSD += c;
        } else if (line.currency === 'SYP') {
          debitSYP += d;
          creditSYP += c;
        }
      });
    });

    return [
      { currencyCode: 'USD', currencySymbol: '$', debit: debitUSD, credit: creditUSD },
      { currencyCode: 'SYP', currencySymbol: 'ل.س', debit: debitSYP, credit: creditSYP },
    ];
  }, [entries, partnerId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-slate-500 font-bold">جاري تحضير كشف الحساب...</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500 font-bold">{error}</div>;
  }

  let runningBalance = 0;

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
            كشف حساب المورد: {partnerName}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="font-bold">
            طباعة الكشف
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="text-right font-bold w-[120px]">التاريخ</TableHead>
                <TableHead className="text-right font-bold w-[100px]">رقم القيد</TableHead>
                <TableHead className="text-right font-bold">البيان / الحركة</TableHead>
                <TableHead className="text-left font-bold w-[120px]">مدين (عليه)</TableHead>
                <TableHead className="text-left font-bold w-[120px]">دائن (له)</TableHead>
                <TableHead className="text-left font-bold w-[140px]">الرصيد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 font-medium italic">
                    لا توجد حركات مسجلة لهذا المورد حتى الآن.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const partnerLines = entry.lines.filter(l => l.partner_id === partnerId);
                  const debit = partnerLines.reduce((sum, l) => sum + parseFloat(l.debit), 0);
                  const credit = partnerLines.reduce((sum, l) => sum + parseFloat(l.credit), 0);
                  runningBalance += (credit - debit);

                  return (
                    <TableRow key={entry.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-medium text-slate-600">
                        {format(new Date(entry.entry_date), 'yyyy/MM/dd')}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {entry.entry_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{entry.description}</span>
                          <span className="text-xs text-slate-400">{entry.journal_type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        {debit > 0 ? (
                          <div className="flex items-center justify-end gap-1 text-red-600 font-bold">
                            {debit.toLocaleString()}
                            <TrendingUp className="w-3 h-3" />
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-left">
                        {credit > 0 ? (
                          <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">
                            {credit.toLocaleString()}
                            <TrendingDown className="w-3 h-3" />
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-left font-black text-slate-900 bg-slate-50/20">
                        {runningBalance.toLocaleString()}
                        <span className="text-[10px] mr-1 text-slate-400">ل.س</span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <TableFooter>
          <TableRow className="bg-slate-50 font-bold">
            <TableCell className="text-slate-400 text-xs">الإجمالي</TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-left text-red-600">{totals.find(t => t.currencyCode === 'SYP')?.debit.toLocaleString() || '0'}</TableCell>
            <TableCell className="text-left text-emerald-600">{totals.find(t => t.currencyCode === 'SYP')?.credit.toLocaleString() || '0'}</TableCell>
            <TableCell className="text-left font-black text-slate-900">{( (totals.find(t => t.currencyCode === 'SYP')?.credit || 0) - (totals.find(t => t.currencyCode === 'SYP')?.debit || 0) ).toLocaleString()}</TableCell>
          </TableRow>
        </TableFooter>
      </CardContent>
    </Card>
  );
};