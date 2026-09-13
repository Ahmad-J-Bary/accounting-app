import React, { useMemo } from 'react';
import { useTableSettings } from '@shared/hooks';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { TableDensity, TableBorderStyle } from '@shared/types/table-settings';
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Slider } from "@shared/ui/slider";
import { 
  LayoutGrid, 
  Type, 
  Monitor,
  Eye
} from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { SettingsManagerLayout, SettingsGroup } from '@widgets/templates/SettingsManagerLayout';
import { useLocalization } from "@app/providers/LocalizationProvider";

interface PreviewRow {
  id: string;
  code: string;
  name: string;
  debit: number;
  credit: number;
  date: string;
  status: string;
}

export const TableSettingsManager: React.FC = () => {
  const { t } = useLocalization();
  const { settings, updateSetting, resetSettings } = useTableSettings();
  const { baseCurrency, formatAmount } = useCurrencyContext();
  const currSym = baseCurrency?.symbol || baseCurrency?.code || "";

  const activeLabel = t("tables.previewData.active", { namespace: "settings",  });
  const PREVIEW_DATA = useMemo<PreviewRow[]>(() => [
    { id: "1", code: "11001", name: t("tables.previewData.cash", { namespace: "settings",  }), debit: 15000, credit: 0, date: "2026-01-15", status: activeLabel },
    { id: "2", code: "21001", name: t("tables.previewData.suppliers", { namespace: "settings",  }), debit: 0, credit: 32000, date: "2026-02-01", status: activeLabel },
    { id: "3", code: "31001", name: t("tables.previewData.capital", { namespace: "settings",  }), debit: 0, credit: 100000, date: "2026-01-01", status: activeLabel },
    { id: "4", code: "41001", name: t("tables.previewData.sales", { namespace: "settings",  }), debit: 0, credit: 45000, date: "2026-02-10", status: t("tables.previewData.closed", { namespace: "settings",  }) },
    { id: "5", code: "51001", name: t("tables.previewData.rentExpense", { namespace: "settings",  }), debit: 3000, credit: 0, date: "2026-02-05", status: activeLabel },
    { id: "6", code: "51002", name: t("tables.previewData.salaries", { namespace: "settings",  }), debit: 12000, credit: 0, date: "2026-02-28", status: t("tables.previewData.closed", { namespace: "settings",  }) },
  ], [t, activeLabel]);

  const previewColumns = useMemo<UnifiedColumn<PreviewRow>[]>(() => [
    {
      id: "code",
      header: t("tables.columns.code", { namespace: "settings",  }),
      label: t("tables.columns.code", { namespace: "settings",  }),
      accessor: "code",
      className: "font-black text-slate-900 text-center"
    },
    {
      id: "name",
      header: t("tables.columns.name", { namespace: "settings",  }),
      label: t("tables.columns.name", { namespace: "settings",  }),
      accessor: "name",
      className: "font-bold text-slate-800"
    },
    {
      id: "debit",
      header: t("tables.columns.debit", { namespace: "settings", vars: { sym: currSym } }),
      label: t("tables.columns.debit", { namespace: "settings", vars: { sym: currSym } }),
      accessor: (r) => r.debit > 0 ? formatAmount(r.debit, { currencyCode: baseCurrency?.code || "" }) : "—",
      className: "tabular-nums font-black text-blue-700",
    },
    {
      id: "credit",
      header: t("tables.columns.credit", { namespace: "settings", vars: { sym: currSym } }),
      label: t("tables.columns.credit", { namespace: "settings", vars: { sym: currSym } }),
      accessor: (r) => r.credit > 0 ? formatAmount(r.credit, { currencyCode: baseCurrency?.code || "" }) : "—",
      className: "tabular-nums font-black text-emerald-700",
    },
    {
      id: "date",
      header: t("tables.columns.date", { namespace: "settings",  }),
      label: t("tables.columns.date", { namespace: "settings",  }),
      accessor: "date",
      className: "tabular-nums text-slate-500"
    },
    {
      id: "status",
      header: t("tables.columns.status", { namespace: "settings",  }),
      label: t("tables.columns.status", { namespace: "settings",  }),
      accessor: (r) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          r.status === activeLabel ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}>
          {r.status}
        </span>
      ),
    },
  ], [currSym, formatAmount, baseCurrency, t, activeLabel]);

  const previewColumnIds = useMemo(() => previewColumns.map(c => c.id), [previewColumns]);

  const summaryColumns = useMemo(() => {
    const colIds = previewColumnIds;
    const totalDebit = PREVIEW_DATA.reduce((s, r) => s + r.debit, 0);
    const totalCredit = PREVIEW_DATA.reduce((s, r) => s + r.credit, 0);
    const totalLabel = t("tables.summaryTotal", { namespace: "settings",  });
    return colIds.map(id => {
      if (id === "debit") return { id: "debit_total", columnId: "debit", label: totalLabel, value: totalDebit > 0 ? formatAmount(totalDebit, { currencyCode: baseCurrency?.code || "" }) : "—", className: "text-blue-700 font-black" };
      if (id === "credit") return { id: "credit_total", columnId: "credit", label: totalLabel, value: totalCredit > 0 ? formatAmount(totalCredit, { currencyCode: baseCurrency?.code || "" }) : "—", className: "text-emerald-700 font-black" };
      if (id === "code") return { id: "code_count", columnId: "code", label: "", value: t("tables.summaryAccounts", { namespace: "settings", vars: { count: PREVIEW_DATA.length } }), className: "text-slate-500 font-medium" };
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [previewColumnIds, formatAmount, baseCurrency, t, PREVIEW_DATA]);

  return (
    <SettingsManagerLayout resetAction={resetSettings}>
      {/* Visual Appearance */}
      <SettingsGroup title={t("tables.groupTitle", { namespace: "settings",  })} icon={LayoutGrid}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">{t("tables.rowDensity", { namespace: "settings",  })}</Label>
            <Select 
              value={settings.density} 
              onValueChange={(v) => updateSetting('density', v as TableDensity)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder={t("tables.densityPlaceholder", { namespace: "settings",  })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">{t("tables.densities.compact", { namespace: "settings",  })}</SelectItem>
                <SelectItem value="comfortable">{t("tables.densities.comfortable", { namespace: "settings",  })}</SelectItem>
                <SelectItem value="spacious">{t("tables.densities.spacious", { namespace: "settings",  })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">{t("tables.borderStyle", { namespace: "settings",  })}</Label>
            <Select 
              value={settings.borderStyle} 
              onValueChange={(v) => updateSetting('borderStyle', v as TableBorderStyle)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200">
                <SelectValue placeholder={t("tables.borderPlaceholder", { namespace: "settings",  })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">{t("tables.borders.full", { namespace: "settings",  })}</SelectItem>
                <SelectItem value="horizontal">{t("tables.borders.horizontal", { namespace: "settings",  })}</SelectItem>
                <SelectItem value="none">{t("tables.borders.none", { namespace: "settings",  })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      {/* Typography */}
      <SettingsGroup title={t("tables.typographyTitle", { namespace: "settings",  })} icon={Type} color="text-amber-600">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-slate-600 font-semibold">{t("tables.fontSize", { namespace: "settings", vars: { size: settings.fontSize } })}</Label>
            </div>
            <Slider
              value={[settings.fontSize]}
              min={10}
              max={18}
              step={1}
              onValueChange={(v) => updateSetting('fontSize', v[0])}
              className="py-2"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">{t("tables.fontFamily", { namespace: "settings",  })}</Label>
            <Select 
              value={settings.fontFamily} 
              onValueChange={(v) => updateSetting('fontFamily', v)}
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200 font-mono">
                <SelectValue placeholder={t("tables.fontPlaceholder", { namespace: "settings",  })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter, system-ui, sans-serif">Inter</SelectItem>
                <SelectItem value="'Cairo', sans-serif">Cairo</SelectItem>
                <SelectItem value="'Tajawal', sans-serif">Tajawal</SelectItem>
                <SelectItem value="monospace">Monospace</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsGroup>

      {/* Behavior */}
      <SettingsGroup title={t("tables.behaviorTitle", { namespace: "settings",  })} icon={Monitor} color="text-emerald-600">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("tables.rowHover", { namespace: "settings",  })}</Label>
            </div>
            <Switch 
              checked={settings.rowHoverEffect} 
              onCheckedChange={(v) => updateSetting('rowHoverEffect', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("tables.zebra", { namespace: "settings",  })}</Label>
            </div>
            <Switch 
              checked={settings.zebraRows} 
              onCheckedChange={(v) => updateSetting('zebraRows', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("tables.stickyHeader", { namespace: "settings",  })}</Label>
            </div>
            <Switch 
              checked={settings.stickyHeader} 
              onCheckedChange={(v) => updateSetting('stickyHeader', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("tables.toolbar", { namespace: "settings",  })}</Label>
            </div>
            <Switch 
              checked={settings.showToolbar} 
              onCheckedChange={(v) => updateSetting('showToolbar', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("tables.summary", { namespace: "settings",  })}</Label>
            </div>
            <Switch 
              checked={settings.showSummary} 
              onCheckedChange={(v) => updateSetting('showSummary', v)} 
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
            <div className="space-y-0.5">
              <Label className="text-slate-700 font-semibold">{t("tables.pagination", { namespace: "settings",  })}</Label>
            </div>
            <Switch 
              checked={settings.showPagination} 
              onCheckedChange={(v) => updateSetting('showPagination', v)} 
            />
          </div>
        </div>
      </SettingsGroup>

      {/* Live Preview */}
      <SettingsGroup title={t("tables.previewTitle", { namespace: "settings",  })} icon={Eye} color="text-violet-600">
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <UnifiedTable
            data={PREVIEW_DATA}
            columns={previewColumns}
            summary={summaryColumns}
            idKey="id"
            tableId="table-settings-preview"
            emptyMessage={t("tables.empty", { namespace: "settings",  })}
            enableResize
          />
        </div>
      </SettingsGroup>
    </SettingsManagerLayout>
  );
};
