import { Button } from "@shared/ui/button";
import { SectionCard } from "@shared/ui/section-card";
import { StatusBadge } from "@shared/ui/status-badge";
import { fmtMoney, toLocalDateStr } from "@shared/lib/format";
import { Eye } from "lucide-react";
import type { PositionAccountLine, OpeningPositionControlDto } from "@erp/shared-types";
import type { OpeningBalanceMigrationDto } from "../../accounting/api/openingBalanceService";
import { MigrationPicker } from "./MigrationPicker";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface PositionControlCardProps {
  candidates: OpeningBalanceMigrationDto[];
  positionId: string;
  onPositionIdChange: (v: string) => void;
  loading: boolean;
  position: OpeningPositionControlDto | null;
  onShow: () => void;
}

export function PositionControlCard({
  candidates,
  positionId,
  onPositionIdChange,
  loading,
  position,
  onShow,
}: PositionControlCardProps) {
  const { t, language } = useLocalization();
return (
    <SectionCard
      title={t("positionControl.title", { namespace: "openingBalance" })}
      icon={<Eye className="w-4 h-4 text-primary" />}
      description={t("positionControl.description", { namespace: "openingBalance" })}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <MigrationPicker id="pos-migration" label={t("positionControl.migrationLabel", { namespace: "openingBalance" })} candidates={candidates} value={positionId} onChange={onPositionIdChange} />
        <Button size="sm" onClick={onShow} disabled={loading} className="bg-primary hover:bg-primary/80 text-white font-bold">
          {loading ? t("positionControl.loading", { namespace: "openingBalance" }) : t("positionControl.showPosition", { namespace: "openingBalance" })}
        </Button>
      </div>

        {(() => {
          const selected = candidates.find((m) => m.id === positionId);
          if (!selected) return null;
          return (
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-muted border border-muted text-xs">
              <span className="font-semibold text-foreground">{t("positionControl.openingStatus", { namespace: "openingBalance" })}</span>
              <StatusBadge status={selected.status} />
              <span className="font-semibold text-foreground">{t("positionControl.cutoverDate", { namespace: "openingBalance" })}</span>
              <span className="tabular-nums font-bold text-foreground">{toLocalDateStr(selected.cutover_date)}</span>
              {selected.notes && <span className="text-muted-foreground truncate">· {selected.notes}</span>}
            </div>
          );
        })()}

        {position && (
          <div className="border border-muted rounded-lg space-y-3 p-3">
            <div className={"flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold " + (position.is_balanced ? "bg-green-50 text-green-700" : "bg-red-50 text-destructive")}>
              <span>{position.is_balanced ? t("positionControl.balanced", { namespace: "openingBalance" }) : t("positionControl.hasDifference", { namespace: "openingBalance" })}</span>
              <span className="tabular-nums">
                {t("positionControl.difference", { namespace: "openingBalance" })} {fmtMoney(position.equity_difference)}
              </span>
            </div>

            {!position.is_balanced && position.difference_message && (
              <div className="px-3 py-2 text-xs bg-warning/10 text-warning rounded-lg">
                {position.difference_message}
              </div>
            )}

            {position.unreconciled_items.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-warning">{t("positionControl.unreconciledTitle", { namespace: "openingBalance" })}</div>
                <div className="border border-warning/20 rounded-lg divide-y divide-warning/20">
                  {position.unreconciled_items.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                      <span className="font-semibold text-foreground">{r.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {t("positionControl.subledger", { namespace: "openingBalance" })} {fmtMoney(r.subledger)} ← {t("positionControl.generalLedger", { namespace: "openingBalance" })} {fmtMoney(r.general_ledger)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {position.validation_errors.length > 0 && (
              <div className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs space-y-1">
                <div className="font-bold">{t("positionControl.validationErrorsTitle", { namespace: "openingBalance" })}</div>
                {position.validation_errors.map((e, i) => (
                  <div key={i} className="ps-1">• {e}</div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {[
                { label: t("positionControl.totalAssets", { namespace: "openingBalance" }), value: position.total_assets, color: "text-primary" },
                { label: t("positionControl.totalLiabilities", { namespace: "openingBalance" }), value: position.total_liabilities, color: "text-success" },
                { label: t("positionControl.netAssets", { namespace: "openingBalance" }), value: position.net_assets, color: "text-foreground font-black" },
                { label: t("positionControl.totalEquity", { namespace: "openingBalance" }), value: position.total_equity, color: "text-indigo-700" },
              ].map((row) => (
                <div key={row.label} className="border border-muted rounded-lg p-2 space-y-0.5 bg-white">
                  <div className="text-muted-foreground font-semibold">{row.label}</div>
                  <div className={"font-bold tabular-nums " + row.color}>{fmtMoney(row.value)}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="border border-muted rounded-lg p-2 space-y-1">
                <div className="text-muted-foreground font-semibold">{t("positionControl.partnerCapital", { namespace: "openingBalance" })}</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.partner_capital)}</div>
              </div>
              <div className="border border-muted rounded-lg p-2 space-y-1">
                <div className="text-muted-foreground font-semibold">{t("positionControl.partnerCurrentAccounts", { namespace: "openingBalance" })}</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.partner_current_accounts)}</div>
              </div>
              <div className="border border-muted rounded-lg p-2 space-y-1">
                <div className="text-muted-foreground font-semibold">{t("positionControl.retainedEarnings", { namespace: "openingBalance" })}</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.retained_earnings)}</div>
              </div>
              <div className="border border-muted rounded-lg p-2 space-y-1">
                <div className="text-muted-foreground font-semibold">{t("positionControl.openingEquityAdjustment", { namespace: "openingBalance" })}</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.opening_equity_adjustment)}</div>
              </div>
              <div className="border border-muted rounded-lg p-2 space-y-1">
                <div className="text-muted-foreground font-semibold">{t("positionControl.otherEquity", { namespace: "openingBalance" })}</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.other_equity)}</div>
              </div>
              <div className="border border-muted rounded-lg p-2 space-y-1">
                <div className="text-muted-foreground font-semibold">{t("positionControl.drawings", { namespace: "openingBalance" })}</div>
                <div className="font-bold tabular-nums text-destructive">{fmtMoney(position.drawings)}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted rounded-lg text-xs">
              <span className="font-semibold text-foreground">
                {t("positionControl.historicalResult", { namespace: "openingBalance" })}
              </span>
              <span className="font-black tabular-nums text-indigo-700">
                {fmtMoney(position.opening_historical_result)}
              </span>
            </div>

            {position.asset_detail.length > 0 && (
              <PositionDetailTable title={t("positionControl.assetDetails", { namespace: "openingBalance" })} lines={position.asset_detail} language={language} />
            )}
            {position.liability_detail.length > 0 && (
              <PositionDetailTable title={t("positionControl.liabilityDetails", { namespace: "openingBalance" })} lines={position.liability_detail} language={language} />
            )}
            {position.equity_detail.length > 0 && (
              <PositionDetailTable title={t("positionControl.equityDetails", { namespace: "openingBalance" })} lines={position.equity_detail} language={language} />
            )}

            {position.partner_rows.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-foreground">{t("positionControl.partnerDetails", { namespace: "openingBalance" })}</div>
                <div className="border border-muted rounded-lg divide-y divide-slate-100">
                  {position.partner_rows.map((p) => (
                    <div key={p.partner_id} className="grid grid-cols-2 md:grid-cols-5 gap-2 px-3 py-2 text-xs items-center">
                      <span className="font-semibold text-foreground">{p.partner_name}</span>
                      <span className="tabular-nums text-muted-foreground">{t("positionControl.capital", { namespace: "openingBalance" })} {fmtMoney(p.capital)}</span>
                      <span className="tabular-nums text-muted-foreground">{t("positionControl.ownershipPercent", { namespace: "openingBalance" })} {fmtMoney(p.ownership_percent)}%</span>
                      <span className="tabular-nums text-muted-foreground">{t("positionControl.current", { namespace: "openingBalance" })} {fmtMoney(p.current)}</span>
                      <span className="tabular-nums text-muted-foreground">{t("positionControl.drawingsLabel", { namespace: "openingBalance" })} {fmtMoney(p.drawings)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
    </SectionCard>
  );
}

function PositionDetailTable({
  title,
  lines,
  language,
}: {
  title: string;
  lines: PositionAccountLine[];
  language: "ar" | "en";
}) {
  const lineName = (line: PositionAccountLine) =>
    language === "ar"
      ? line.name_ar || line.name_en || line.code
      : line.name_en || line.name_ar || line.code;

  return (
    <div className="space-y-1">
      <div className="text-xs font-bold text-foreground">{title}</div>
      <div className="border border-muted rounded-lg divide-y divide-slate-100">
        {lines.map((l) => (
          <div key={l.account_id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xs font-bold text-muted-foreground tabular-nums">{l.code}</span>
              <span className="truncate text-foreground">{lineName(l)}</span>
              <span className="text-2xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{l.group_key}</span>
            </div>
            <span className="tabular-nums font-semibold text-foreground">{fmtMoney(l.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
