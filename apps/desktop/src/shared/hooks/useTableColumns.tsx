import React, { useCallback } from "react";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useBaseCurrencyColumns } from "./useBaseCurrencyColumns";
import {  effectiveBalanceBase, balanceDirectionLabel} from "@shared/lib/balance-utils";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function useTableColumns() {
  const { currencies, baseCurrency, formatAmount, toBase } = useCurrencyContext();
  const { currencySuffix: cs } = useBaseCurrencyColumns();
  const { t } = useLocalization();

  const getAccountStatusColumn = useCallback(<T extends { balance?: number | string; debit?: number | string; credit?: number | string }>(
    sortableHeader: React.ReactNode,
    options?: { partnerType?: "customer" | "supplier" }
  ): UnifiedColumn<T> => {
    const partnerType = options?.partnerType ?? "customer";
    return {
      id: "status",
      header: sortableHeader,
      label: t("labels.accountStatus", { namespace: "common" }),
      accessor: (item) => {
        const bal = effectiveBalanceBase(
          item.debit !== undefined ? Number(item.debit || 0) : undefined,
          item.credit !== undefined ? Number(item.credit || 0) : undefined,
          Number(item.balance || 0),
          partnerType
        );
        if (bal === 0) return <span className="text-slate-300">—</span>;
        const isDebit = bal > 0;
        return (
          <span className={`font-bold ${isDebit ? "text-red-600" : "text-emerald-600"}`}>
            {isDebit ? t("labels.debit", { namespace: "common" }) : t("labels.creditSide", { namespace: "common" })}
          </span>
        );
      }
    };
  }, [t]);

  const getBalanceColumns = useCallback(<T extends { balance?: number | string; debit?: number | string; credit?: number | string; currency?: string }>(
  ): UnifiedColumn<T>[] => {
    return currencies.map(curr => {
      const symbol = curr.symbol || curr.code;
      return {
        id: `balance_${curr.code}`,
        header: `${t("labels.balance", { namespace: "common" })}${cs(symbol)}`,
        label: `${t("labels.balance", { namespace: "common" })}${cs(symbol)}`,
        accessor: (item) => {
          const effectiveBalance = (item.debit !== undefined && item.credit !== undefined)
            ? Number(item.debit || 0) - Number(item.credit || 0)
            : Number(item.balance || 0);
          if (effectiveBalance === 0) return "";
          const baseAmount = toBase(effectiveBalance, item.currency || baseCurrency?.code || "");
          return formatAmount(baseAmount, { currencyCode: curr.code });
        },
        className: "tabular-nums font-black text-slate-900"
      };
    });
  }, [currencies, formatAmount, toBase, baseCurrency?.code, cs, t]);

  const getSummaryColumns = useCallback(<T extends { balance?: number | string; debit?: number | string; credit?: number | string; currency?: string }>(
    enrichedColumns: UnifiedColumn<T>[],
    items: T[],
    countLabel: string,
    options?: { partnerType?: "customer" | "supplier" }
  ): SummaryColumn[] => {
    const partnerType = options?.partnerType ?? "customer";
    const totalEffectiveBalance = items.reduce((sum, item) => {
      return sum + effectiveBalanceBase(
        item.debit !== undefined ? Number(item.debit || 0) : undefined,
        item.credit !== undefined ? Number(item.credit || 0) : undefined,
        Number(item.balance || 0),
        partnerType
      );
    }, 0);
    const overallLabel = totalEffectiveBalance !== 0 ? balanceDirectionLabel(
      totalEffectiveBalance > 0 ? totalEffectiveBalance : 0,
      totalEffectiveBalance < 0 ? -totalEffectiveBalance : 0,
      partnerType
    ) : null;
    const overallColor = totalEffectiveBalance > 0
      ? 'text-red-600'
      : totalEffectiveBalance < 0
      ? 'text-emerald-600'
      : 'text-slate-400';

    const baseTotal = items.reduce((sum, item) => {
      const effBal = effectiveBalanceBase(
        item.debit !== undefined ? Number(item.debit || 0) : undefined,
        item.credit !== undefined ? Number(item.credit || 0) : undefined,
        Number(item.balance || 0),
        partnerType
      );
      if (effBal === 0) return sum;
      return sum + toBase(effBal, item.currency || baseCurrency?.code || "");
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
          label: overallLabel ? `${t("labels.balance", { namespace: "common" })} / ${overallLabel}` : "—",
          value: baseTotal !== 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
          className: valueClass,
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [formatAmount, toBase, baseCurrency, t]);

  return {
    getAccountStatusColumn,
    getBalanceColumns,
    getSummaryColumns
  };
}
