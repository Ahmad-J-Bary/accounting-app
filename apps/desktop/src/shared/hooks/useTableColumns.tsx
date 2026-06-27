import React, { useCallback } from "react";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export function useTableColumns() {
  const { currencies, baseCurrency, formatAmount, toBase } = useCurrencyContext();

  const getAccountStatusColumn = useCallback(<T extends { balance?: number | string; debit?: number | string; credit?: number | string }>(
    sortableHeader: React.ReactNode,
    options?: { isCreditFirst?: boolean }
  ): UnifiedColumn<T> => {
    const isCreditFirst = options?.isCreditFirst ?? false;
    return {
      id: "status",
      header: sortableHeader,
      label: "حالة الحساب",
      accessor: (item) => {
        // Prefer recomputing from debit/credit for accuracy (fallback to stored balance)
        const effectiveBalance = (item.debit !== undefined && item.credit !== undefined)
          ? (Number(item.debit || 0) - Number(item.credit || 0)) * (isCreditFirst ? -1 : 1)
          : Number(item.balance || 0);
        const bal = effectiveBalance;
        if (bal === 0) return <span className="text-slate-300">—</span>;
        const isPositive = bal > 0;
        const isDebit = isCreditFirst ? !isPositive : isPositive;
        return (
          <span className={`font-bold ${isDebit ? "text-red-600" : "text-emerald-600"}`}>
            {isDebit ? "مدين" : "دائن"}
          </span>
        );
      }
    };
  }, []);

  const getBalanceColumns = useCallback(<T extends { balance?: number | string; debit?: number | string; credit?: number | string; currency?: string }>(
    sortableHeader: React.ReactNode
  ): UnifiedColumn<T>[] => {
    return currencies.map(curr => {
      const symbol = curr.symbol || curr.code;
      return {
        id: `balance_${curr.code}`,
        header: `الرصيد (${symbol})`,
        label: `الرصيد (${symbol})`,
        accessor: (item) => {
          const absBal = Math.abs(Number(item.balance || 0));
          if (absBal === 0) return "";
          const baseAmount = toBase(absBal, item.currency);
          return formatAmount(baseAmount, { currencyCode: curr.code });
        },
        className: "tabular-nums font-black text-slate-900"
      };
    });
  }, [currencies, formatAmount, toBase]);

  const getSummaryColumns = useCallback(<T extends { balance?: number | string; debit?: number | string; credit?: number | string; currency?: string }>(
    enrichedColumns: UnifiedColumn<T>[],
    items: T[],
    countLabel: string,
    options?: { isCreditFirst?: boolean }
  ): SummaryColumn[] => {
    const isCreditFirst = options?.isCreditFirst ?? false;
    const totalBal = items.reduce((sum, item) => {
      const effectiveBalance = (item.debit !== undefined && item.credit !== undefined)
        ? (Number(item.debit || 0) - Number(item.credit || 0)) * (isCreditFirst ? -1 : 1)
        : Number(item.balance || 0);
      return sum + effectiveBalance;
    }, 0);
    const isPositive = totalBal > 0;
    const overallIsDebit = isCreditFirst ? !isPositive : isPositive;
    const overall = totalBal !== 0 ? (overallIsDebit ? "مدين" : "دائن") : null;
    const overallColor = overallIsDebit ? 'text-red-600' : (totalBal !== 0 ? 'text-emerald-600' : 'text-slate-400');

    const baseTotal = items.reduce((sum, item) => {
      const bal = Math.abs(Number(item.balance || 0));
      if (bal === 0) return sum;
      return sum + toBase(bal, item.currency);
    }, 0);

    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === 'name') return {
        id: 'count',
        columnId: 'name',
        label: '',
        value: `${items.length} ${countLabel}`,
        className: 'text-slate-500 font-medium'
      };
      if (['code', 'status', 'phone', 'actions'].includes(id)) return {
        id: `${id}_spacer`,
        columnId: id,
        label: '',
        value: ''
      };
      const match = id.match(/^balance_(.+)$/);
      if (match) {
        const currCode = match[1];
        const isBaseColumn = baseCurrency?.code === currCode;
        const valueClass = isBaseColumn
          ? `${overallColor} font-black`
          : 'text-slate-500 font-extrabold';
        return {
          id: `${id}_summary`,
          columnId: id,
          label: overall ? `الرصيد / ${overall}` : "—",
          value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
          className: valueClass,
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [formatAmount, toBase, baseCurrency]);

  return {
    getAccountStatusColumn,
    getBalanceColumns,
    getSummaryColumns
  };
}
