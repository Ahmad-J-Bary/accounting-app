import type { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { Card, CardContent } from "@shared/ui/card";
import { Scale, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@shared/ui/status-badge";
import { fmtMoney } from "@shared/lib/format";
import { useLocalization } from "@app/providers/LocalizationProvider";

export interface OpeningPositionSummaryProps {
  cash: number;
  bank: number;
  receivables: number;
  inventory: number;
  fixedAssets: number;
  suppliers: number;
  loans: number;
  otherLiabilities: number;
  partnerCapital: number;
  partnerCurrent: number;
  otherEquity: number;
  /** Net Assets − Recognized Equity (debit − credit before any plug). */
  residual: number;
  /** > 0 when the residual has been classified onto the OBE (53) control. */
  plugAmount: number;
  balanced: boolean;
  /** Smart, section-targeted Arabic hints (empty when everything is clean). */
  hints?: string[];
}

function Row({ label, value, strong }: { label: ReactNode; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className={strong ? "font-bold text-foreground" : "text-muted-foreground font-medium"}>{label}</span>
      <span className={cn("tabular-nums", strong ? "font-black text-foreground" : "font-semibold text-foreground")}>
        {fmtMoney(value)}
      </span>
    </div>
  );
}

function SectionLabel({ children, color }: { children: ReactNode; color: string }) {
  return <div className={cn("text-2xs font-bold", color)}>{children}</div>;
}

/**
 * Live Opening Position summary derived directly from wizard state (never from
 * the backend — the migration may not be saved yet). Renders the §13 balance
 * sheet structure with the exact difference and balance status, updating on
 * every keystroke via normal React re-render.
 */
export function OpeningPositionSummary({
  cash,
  bank,
  receivables,
  inventory,
  fixedAssets,
  suppliers,
  loans,
  otherLiabilities,
  partnerCapital,
  partnerCurrent,
  otherEquity,
  residual,
  plugAmount,
  balanced,
  hints = [],
}: OpeningPositionSummaryProps) {
  const { t } = useLocalization();
  const totalAssets = cash + bank + receivables + inventory + fixedAssets;
  const totalLiabilities = suppliers + loans + otherLiabilities;
  const netAssets = totalAssets - totalLiabilities;
  const recognizedEquity = partnerCapital + partnerCurrent + otherEquity;
  const equityWithPlug = recognizedEquity + Math.max(plugAmount, 0);

  return (
    <Card className="border-muted shadow-sm">
      <CardContent className="space-y-2.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-primary" />
            {t("openingBalance.balanceSummary", { namespace: "accounting",  })}
          </span>
          <StatusBadge
            status={balanced ? t("openingBalance.statusBalanced", { namespace: "accounting",  }) : t("openingBalance.statusDiff", { namespace: "accounting",  })}
            label={balanced ? t("openingBalance.balanced", { namespace: "accounting",  }) : t("openingBalance.positionDiff", { namespace: "accounting",  })}
            tone={balanced ? "green" : "red"}
          />
        </div>

        {hints.length > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5 space-y-1">
            {hints.map((h, i) => (
              <p key={i} className="text-2xs text-red-700 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                {h}
              </p>
            ))}
          </div>
        )}

        <div className="border border-blue-100 rounded-lg p-2 space-y-1 bg-primary/10/40">
          <SectionLabel color="text-blue-700">{t("openingBalance.assets", { namespace: "accounting",  })}</SectionLabel>
          <Row label={t("openingBalance.cashAndBanks", { namespace: "accounting",  })} value={cash} />
          <Row label={t("openingBalance.banks", { namespace: "accounting",  })} value={bank} />
          <Row label={t("openingBalance.receivables", { namespace: "accounting",  })} value={receivables} />
          <Row label={t("openingBalance.inventoryBalance", { namespace: "accounting",  })} value={inventory} />
          <Row label={t("openingBalance.fixedAssetsNet", { namespace: "accounting",  })} value={fixedAssets} />
          <div className="pt-1 border-t border-blue-100">
            <Row label={t("openingBalance.totalAssets", { namespace: "accounting",  })} value={totalAssets} strong />
          </div>
        </div>

        <div className="border border-success/20 rounded-lg p-2 space-y-1 bg-success/10/40">
          <SectionLabel color="text-success">{t("openingBalance.liabilities", { namespace: "accounting",  })}</SectionLabel>
          <Row label={t("openingBalance.suppliers", { namespace: "accounting",  })} value={suppliers} />
          <Row label={t("openingBalance.loans", { namespace: "accounting",  })} value={loans} />
          <Row label={t("openingBalance.otherLiabilities", { namespace: "accounting",  })} value={otherLiabilities} />
          <div className="pt-1 border-t border-success/20">
            <Row label={t("openingBalance.totalLiabilities", { namespace: "accounting",  })} value={totalLiabilities} strong />
          </div>
        </div>

        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-2 py-1.5">
          <Row label={t("openingBalance.netAssets", { namespace: "accounting",  })} value={netAssets} strong />
        </div>

        <div className="border border-indigo-100 rounded-lg p-2 space-y-1 bg-indigo-50/40">
          <SectionLabel color="text-indigo-700">{t("openingBalance.equity", { namespace: "accounting",  })}</SectionLabel>
          <Row label={t("openingBalance.partnerCapital", { namespace: "accounting",  })} value={partnerCapital} />
          <Row label={t("openingBalance.currentAccounts", { namespace: "accounting",  })} value={partnerCurrent} />
          <Row label={t("openingBalance.otherEquity", { namespace: "accounting",  })} value={otherEquity} />
          {plugAmount > 0 && <Row label={t("openingBalance.openingAdjustment", { namespace: "accounting",  })} value={plugAmount} />}
          <div className="pt-1 border-t border-indigo-100">
            <Row label={t("openingBalance.totalRecognizedEquity", { namespace: "accounting",  })} value={equityWithPlug} strong />
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg px-2.5 py-2 text-xs font-bold flex items-center justify-between",
            balanced ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200",
          )}
        >
          <span>{balanced ? t("openingBalance.balancedCheck", { namespace: "accounting",  }) : t("openingBalance.unclassifiedDifference", { namespace: "accounting",  })}</span>
          <span className="tabular-nums font-black">{fmtMoney(balanced ? 0 : residual)}</span>
        </div>

        <p className="text-2xs text-muted-foreground">
          {t("openingBalance.residualExplanation", { namespace: "accounting",  })}
        </p>
      </CardContent>
    </Card>
  );
}