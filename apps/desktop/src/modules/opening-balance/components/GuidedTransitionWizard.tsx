import { useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { TabContext } from "@app/providers/TabContext";
import type { AccountDto, ResidualClassificationSpecDto } from "@erp/shared-types";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { cn } from "@shared/lib/utils";
import { StatusBadge } from "@shared/ui/status-badge";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toLocalDateStr, toFixed, fmtMoney } from "@shared/lib/format";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { WizardShell } from "@modules/opening-balance/components/WizardShell";
import { WizardLineEditor } from "@modules/opening-balance/components/WizardLineEditor";
import { QuickCreateInline } from "@modules/opening-balance/components/QuickCreateInline";
import { QuickCreateFixedAsset } from "@modules/opening-balance/components/QuickCreateFixedAsset";
import { QuickCreatePartner } from "@modules/opening-balance/components/QuickCreatePartner";
import { useOpeningBalanceWizard, STEP_REVIEW, STEP_ACTION } from "@modules/opening-balance/hooks/useOpeningBalanceWizard";
import { START_MODE_NEW, toNum, type DerivedRow, type WizLine } from "@modules/opening-balance/lib/wizard-types";
import { sumLines, inventoryMismatchHints } from "@modules/opening-balance/lib/derive-rows";
import { reconciliationReadiness, RECON_ROW_LABEL } from "@modules/opening-balance/lib/migration-labels";
import { ReconciliationStatusBanner } from "@modules/opening-balance/components/ReconciliationStatusBanner";
import { AutoAmountSection } from "@modules/opening-balance/components/AutoAmountSection";
import { InlineBalanceRow } from "@modules/opening-balance/components/InlineBalanceRow";
import { InventorySection } from "@modules/opening-balance/components/InventorySection";
import { ReconciliationRowsTable } from "@modules/opening-balance/components/ReconciliationRowsTable";
import { AccountCombobox } from "@modules/opening-balance/components/AccountCombobox";
import { AccountLineRow } from "@modules/opening-balance/components/AccountLineRow";
import { OpeningPositionSummary } from "@modules/opening-balance/components/OpeningPositionSummary";
import { OpeningProgressChecklist, type ChecklistItem } from "@modules/opening-balance/components/OpeningProgressChecklist";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function GuidedTransitionWizard() {
  const { t } = useLocalization();
  const w = useOpeningBalanceWizard();
  const isNew = w.startMode === START_MODE_NEW;
  const navigate = useNavigate();
  const tabs = useContext(TabContext);

  // The shell renders every page inside a TAB whose route comes from
  // `openTab` — plain `navigate("/dashboard")` only rewrites the URL and leaves
  // the current tab on the opening page. Real navigation closes the opening tab
  // and switches to the dashboard tab via TabProvider (falls back to navigate
  // when no tab shell is present, e.g. in isolated component tests).
  const goDashboard = () => {
    if (tabs) {
      tabs.closeTab(tabs.activeTabId);
      tabs.openTab({ id: "/dashboard", title: t("wizard.dashboardTab", { namespace: "openingBalance" }), path: "/dashboard" });
      return;
    }
    navigate("/dashboard");
  };

  // Opens any route through the tab system (closing the current opening tab) so
  // the navigation behaves identically to every other report transition.
  const goTo = (path: string, title: string) => {
    if (tabs) {
      tabs.closeTab(tabs.activeTabId);
      tabs.openTab({ id: path, title, path });
      return;
    }
    navigate(path);
  };

  const handleNext = () => {
    // The final step's «إنهاء» finishes the flow: transition to the dashboard
    // instead of remaining stuck on the completion step.
    if (w.step === w.steps.length - 1) {
      goDashboard();
      return;
    }
    // Data-entry steps (0-6): first click marks step complete, second click advances.
    // NewCompany mode is excluded — its step 0 directly runs the step action.
    if (w.startMode !== START_MODE_NEW && w.step >= 0 && w.step < STEP_REVIEW && !w.userCompletedSteps.has(w.step)) {
      void w.markStepComplete(w.step);
      return;
    }
    void w.handleNext();
  };

  // Use completedSteps from the hook (single source of truth).
  const completedSteps = w.completedSteps;

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => warehouseService.list(),
  });

  const renderDone = () => {
    const locked = w.migration?.status === "Locked";
    return (
      <div className="space-y-3">
        <div className={"rounded-lg p-4 text-center " + (isNew || locked ? "bg-green-50 text-green-700" : "bg-warning/10 text-warning")}>
          <p className="text-base font-black">
            {isNew ? t("wizard.doneNewTitle", { namespace: "openingBalance" }) : locked ? t("wizard.doneLockedTitle", { namespace: "openingBalance" }) : t("wizard.doneFallbackTitle", { namespace: "openingBalance" })}
          </p>
          <p className="text-xs mt-1">
            {isNew ? (
              t("wizard.doneNewDesc", { namespace: "openingBalance" })
            ) : locked ? (
              t("wizard.doneLockedDesc", { namespace: "openingBalance" })
            ) : (
              <>حالة الترحيل النهائية: <StatusBadge status={w.migration?.status || ""} /> — تاريخ القطع: {toLocalDateStr(w.migration?.cutover_date || "")}</>
            )}
          </p>
        </div>
        {w.firstPeriod && (
          <div className="rounded-lg p-3 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {t("wizard.firstPeriodLabel", { namespace: "openingBalance" })}{toLocalDateStr(w.firstPeriod.start_date)} ← {toLocalDateStr(w.firstPeriod.end_date)}
          </div>
        )}
        <div className="flex justify-center pt-1">
          <Button size="sm" onClick={goDashboard} className="bg-green-600 hover:bg-green-700 text-white font-bold">
            {t("wizard.goToDashboard", { namespace: "openingBalance" })}
          </Button>
        </div>
      </div>
    );
  };

  const renderTotalsSummary = () => (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("wizard.balanceEquation", { namespace: "openingBalance" })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-border rounded-lg p-3 space-y-1 bg-card">
          <div className="text-xs font-semibold text-primary">{t("wizard.assetsDebit", { namespace: "openingBalance" })}</div>
          <div className="text-xl font-black tabular-nums text-primary">{toFixed(w.totals.debit, 2)}</div>
        </div>
        <div className="border border-border rounded-lg p-3 space-y-1 bg-card">
          <div className="text-xs font-semibold text-success">{t("wizard.liabilitiesCredit", { namespace: "openingBalance" })}</div>
          <div className="text-xl font-black tabular-nums text-success">{toFixed(w.totals.liabilities, 2)}</div>
        </div>
        <div className="border border-border rounded-lg p-3 space-y-1 bg-card">
          <div className="text-xs font-semibold text-indigo-700">{t("wizard.equityCredit", { namespace: "openingBalance" })}</div>
          <div className="text-xl font-black tabular-nums text-indigo-700">
            {toFixed(w.totals.equity + w.totals.plugAmount, 2)}
          </div>
        </div>
      </div>

      {w.totals.residual > 0 && (
        <ResidualClassificationSection
          residual={w.totals.residual}
          plugAmount={w.totals.plugAmount}
          specs={w.residualSpecs}
          value={w.residualClassification}
          onValueChange={w.handleClassificationChange}
          residualAccountId={w.residualAccountId}
          onResidualAccountChange={w.setResidualAccountId}
          accounts={w.accounts}
          spec={w.residualSpec}
        />
      )}

      {w.totals.residual < 0 && (
        <NegativeResidualSection
          residual={w.totals.residual}
          manualLines={w.assetsManual}
          onAdd={w.addManualDebitLine}
          onUpdate={w.updateManualDebitLine}
          onRemove={w.removeManualDebitLine}
          accounts={w.accounts}
          detailAccounts={w.detailAccounts}
        />
      )}

      {w.totals.plugAmount !== 0 && (
        <div className="rounded-lg p-3 text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          {t("wizard.autoPlugLine", { namespace: "openingBalance", vars: { amount: toFixed(w.totals.plugAmount, 2) } })}
        </div>
      )}

      <div className={"rounded-lg p-3 text-sm font-bold " + (w.totals.balanced ? "bg-green-50 text-green-700" : "bg-destructive/10 text-destructive")}>
        {w.totals.balanced
          ? t("wizard.balancedStatus", { namespace: "openingBalance", vars: { debit: toFixed(w.totals.debit, 2), credit: toFixed(w.totals.credit, 2) } })
          : t("wizard.unbalancedStatus", { namespace: "openingBalance", vars: { diff: toFixed(w.totals.debit - w.totals.credit, 2) } })}
      </div>
    </div>
  );

  const renderStep = () => {
    switch (w.step) {
      case 0:
        return (
          <div className="space-y-4">
            {isNew && (
              <>
                <div className="rounded-lg border border-primary/20 bg-primary/10/60 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-primary">{t("wizard.newCompanyMode", { namespace: "openingBalance" })}</p>
                  <p className="text-xs text-primary">
                    {t("wizard.newCompanyDesc", { namespace: "openingBalance" })}
                  </p>
                </div>
                <FirstPeriodFields
                  start={w.firstPeriodStart}
                  end={w.firstPeriodEnd}
                  onStart={w.setFirstPeriodStart}
                  onEnd={w.setFirstPeriodEnd}
                  created={w.firstPeriod}
                />
              </>
            )}

            {!isNew && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="wiz-cutover-date" required>{t("wizard.cutoverDate", { namespace: "openingBalance" })}</FieldLabel>
                    <Input id="wiz-cutover-date" type="date" value={w.cutoverDate} onChange={(e) => w.setCutoverDate(e.target.value)} className="h-9" />
                  </div>
                </div>
              </>
            )}
          </div>
        );
      case 1:
        if (isNew) return renderDone();
        return (
          <div className="space-y-4">
            <AutoAmountSection
              title={t("wizard.cashTitle", { namespace: "openingBalance" })}
              rows={w.cashBanks.filter((l) => l.kind === "cash")}
              onPatch={(key, patch) => w.updateLine(w.setCashBanks, key, patch)}
              onDelete={(key) => w.updateLine(w.setCashBanks, key, { amount: "" })}
              fixedAccountName={w.fixedCashAccountName}
              nativeHint="debit"
            />
            <AutoAmountSection
              title={t("wizard.banksTitle", { namespace: "openingBalance" })}
              rows={w.cashBanks.filter((l) => l.kind === "bank")}
              onPatch={(key, patch) => w.updateLine(w.setCashBanks, key, patch)}
              onDelete={(key) => w.updateLine(w.setCashBanks, key, { amount: "" })}
              fixedAccountName={w.fixedBankAccountName}
              nativeHint="debit"
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            <InlineRows
              title={t("wizard.arTitle", { namespace: "openingBalance" })}
              rows={w.derivedAr}
              onSave={w.saveCustomerOpening}
              onDelete={(row) => w.saveCustomerOpening(row, "0")}
              label={t("wizard.customerBalance", { namespace: "openingBalance" })}
              nativeHint="debit"
              addForm={
                <QuickCreateInline
                  label={t("wizard.customerLabel", { namespace: "openingBalance" })}
                  placeholder={t("wizard.customerPlaceholder", { namespace: "openingBalance" })}
                  amountLabel={t("wizard.openingBalanceLabel", { namespace: "openingBalance" })}
                  direction="debit"
                  onCreate={(name, amount) => w.createCustomer(name, amount)}
                  navLink={
                    <Button size="sm" variant="outline" onClick={() => goTo("/customers", t("wizard.customersPage", { namespace: "openingBalance" }))} className="h-8 shrink-0 rounded-full border-primary/20 bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/20 hover:border-primary/40 transition-all">
                      {t("wizard.customersPageButton", { namespace: "openingBalance" })}
                      <ArrowLeft className="w-3.5 h-3.5 me-1" />
                    </Button>
                  }
                />
              }
            />
          </div>
        );
      case 3:
        return (
          <InventorySection
            rows={w.effectiveInventory}
            onRowChange={w.setInventoryRow}
            total={w.inventoryTotal}
            onNavigateToInvoice={() => goTo("/opening-balance", t("wizard.openingInvoiceTab", { namespace: "openingBalance" }))}
          />
        );
      case 4:
        return (
          <div className="space-y-3">
            <InlineRows
              title={t("wizard.fixedAssetsTitle", { namespace: "openingBalance" })}
              rows={w.faRows}
              onSave={w.saveFixedAssetOverride}
              onDelete={w.deleteFixedAsset}
              label={t("wizard.openingValue", { namespace: "openingBalance" })}
              nativeHint="debit"
              addForm={
                <QuickCreateFixedAsset
                  warehouses={warehouses}
                  onCreate={(data) => w.createFixedAssetQuick(data)}
                  navLink={
                    <Button size="sm" variant="outline" onClick={() => goTo("/fixed-assets", t("wizard.fixedAssetsTitle", { namespace: "openingBalance" }))} className="h-8 shrink-0 rounded-full border-primary/20 bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/20 hover:border-primary/40 transition-all">
                      {t("wizard.fixedAssetsPageButton", { namespace: "openingBalance" })}
                      <ArrowLeft className="w-3.5 h-3.5 me-1" />
                    </Button>
                  }
                />
              }
            />
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <InlineRows
              title={t("wizard.apTitle", { namespace: "openingBalance" })}
              rows={w.derivedAp}
              onSave={w.saveSupplierOpening}
              onDelete={(row) => w.saveSupplierOpening(row, "0")}
              label={t("wizard.supplierBalance", { namespace: "openingBalance" })}
              nativeHint="credit"
              addForm={
                <QuickCreateInline
                  label={t("wizard.supplierLabel", { namespace: "openingBalance" })}
                  placeholder={t("wizard.supplierPlaceholder", { namespace: "openingBalance" })}
                  amountLabel={t("wizard.openingBalanceLabel", { namespace: "openingBalance" })}
                  direction="credit"
                  onCreate={(name, amount) => w.createSupplier(name, amount)}
                  navLink={
                    <Button size="sm" variant="outline" onClick={() => goTo("/suppliers", t("wizard.suppliersPage", { namespace: "openingBalance" }))} className="h-8 shrink-0 rounded-full border-primary/20 bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/20 hover:border-primary/40 transition-all">
                      {t("wizard.suppliersPageButton", { namespace: "openingBalance" })}
                      <ArrowLeft className="w-3.5 h-3.5 me-1" />
                    </Button>
                  }
                />
              }
            />
            <AutoAmountSection
              title={t("wizard.loansTitle", { namespace: "openingBalance" })}
              rows={w.loans}
              onPatch={(key, patch) => w.updateLine(w.setLoans, key, patch)}
              onDelete={(key) => w.updateLine(w.setLoans, key, { amount: "" })}
              fixedAccountName={w.fixedLoanAccountName}
              nativeHint="credit"
            />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{t("wizard.otherLiabilities", { namespace: "openingBalance" })}</span>
                {w.liabilitiesManual.some((l) => parseFloat(l.amount) > 0) && (
                  <span className="rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-xs font-bold text-success tabular-nums">
                    {toFixed(w.liabilitiesManual.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), 2)}
                  </span>
                )}
              </div>
              <WizardLineEditor rows={w.liabilitiesManual} setter={w.setLiabilitiesManual} updateLine={w.updateLine} placeholder="ابحث واختر حساب التزام..." accounts={w.accounts} detailAccounts={w.detailAccounts} />
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-3">
            <InlineRows
              title={t("wizard.partnersTitle", { namespace: "openingBalance" })}
              rows={w.partnerEquity}
              onSave={w.savePartnerCapital}
              onDelete={w.deletePartner}
              label={t("wizard.capitalLabel", { namespace: "openingBalance" })}
              nativeHint="credit"
              addForm={
                <QuickCreatePartner
                  onCreate={(data) => w.createPartnerQuick(data)}
                  navLink={
                    <Button size="sm" variant="outline" onClick={() => goTo("/partners", t("wizard.partnersPage", { namespace: "openingBalance" }))} className="h-8 shrink-0 rounded-full border-primary/20 bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/20 hover:border-primary/40 transition-all">
                      {t("wizard.partnersPageButton", { namespace: "openingBalance" })}
                      <ArrowLeft className="w-3.5 h-3.5 me-1" />
                    </Button>
                  }
                />
              }
            />
            {w.partnerCurrentManualRows.length > 0 && (
              <InlineRows
                title={t("wizard.partnerCurrentTitle", { namespace: "openingBalance" })}
                rows={w.partnerCurrentManualRows}
                onSave={w.savePartnerCurrentAccount}
                onDelete={(row) => w.setPartnerCurrentManual((prev) => prev.filter((l) => l.key !== row.key))}
                label={t("wizard.currentAccountLabel", { namespace: "openingBalance" })}
                nativeHint="credit"
              />
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{t("wizard.otherEquity", { namespace: "openingBalance" })}</span>
                {w.equityManual.some((l) => parseFloat(l.amount) > 0) && (
                  <span className="rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-xs font-bold text-success tabular-nums">
                    {toFixed(w.equityManual.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), 2)}
                  </span>
                )}
              </div>
              <WizardLineEditor rows={w.equityManual} setter={w.setEquityManual} updateLine={w.updateLine} placeholder="ابحث واختر حساب حقوق ملكية..." accounts={w.accounts} detailAccounts={w.detailAccounts} />
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4">
            {renderTotalsSummary()}
            <div className="rounded-lg border border-border bg-muted/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">{t("wizard.reviewHint", { namespace: "openingBalance" })}</p>
              <p className="text-xs text-muted-foreground">
                {t("wizard.reviewDesc", { namespace: "openingBalance" })}
                عدد البنود: {w.collectLines().length} ·
                العملاء: {w.derivedAr.length} · الموردون: {w.derivedAp.length} ·
                الأصول الثابتة: {w.faRows.length} · حقوق الشركاء: {w.partnerEquity.length + w.partnerCurrentManual.length}
              </p>
            </div>
            {w.reconciliation && (
              <div className="space-y-3">
                <ReconciliationRowsTable
                  rows={w.reconciliation.rows}
                  allReconciled={w.reconciliation.all_reconciled}
                  openingControlBalance={w.reconciliation.opening_control_balance}
                  debitTotal={w.reconciliation.debit_total}
                  creditTotal={w.reconciliation.credit_total}
                />
                <ReconciliationStatusBanner readiness={reconciliationReadiness(w.reconciliation, t)} />
              </div>
            )}
            {w.residualClassification === "RetainedEarnings" && (
              <div className="rounded-lg border border-primary/20 bg-primary/10/60 p-3 space-y-2">
                <p className="text-xs font-bold text-indigo-700">
                  {t("wizard.retainedEarningsNote", { namespace: "openingBalance" })}
                </p>
                <p className="text-xs text-indigo-600">
                  {t("wizard.retainedEarningsDesc", { namespace: "openingBalance" })}
                </p>
                <Button
                  size="sm"
                  onClick={() => goTo(
                    `/partners?profit-distribution=open&migration=${w.migration?.id ?? ""}`,
                    t("wizard.partnersTitle", { namespace: "openingBalance" }),
                  )}
                  className="bg-primary hover:bg-primary/80 text-white font-bold"
                >
                  {t("wizard.profitDistribution", { namespace: "openingBalance" })}
                </Button>
              </div>
            )}
          </div>
        );
      case STEP_ACTION: {
        return (
          <div className="space-y-3">
            <p className="text-sm font-bold text-foreground">{t("wizard.actionTitle", { namespace: "openingBalance" })}</p>
            <p className="text-xs text-muted-foreground">
              {t("wizard.actionDesc", { namespace: "openingBalance" })}
            </p>
            <div className="text-xs font-semibold text-muted-foreground flex items-center">
              {t("wizard.currentStatus", { namespace: "openingBalance" })}
              {w.migration ? (
                <StatusBadge status={w.migration.status} className="me-1.5" />
              ) : (
                <span className="text-muted-foreground me-1.5">—</span>
              )}
              {w.migration && w.migration.notes && <span> · {w.migration.notes}</span>}
            </div>
            <div className="rounded-lg border border-border bg-muted/60 p-3 space-y-1.5">
              {[
                { label: t("wizard.validationCheck", { namespace: "openingBalance" }), done: ["Validated", "Posted", "Locked"].includes(w.migration?.status || "") },
                { label: t("wizard.postingCheck", { namespace: "openingBalance" }), done: ["Posted", "Locked"].includes(w.migration?.status || "") },
                { label: t("wizard.lockCheck", { namespace: "openingBalance" }), done: w.migration?.status === "Locked" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs font-semibold">
                  <span className={cn("rounded-full p-0.5", item.done ? "bg-success text-white" : "bg-slate-300 text-white")}>
                    <Check className="w-3 h-3" />
                  </span>
                  <span className={item.done ? "text-success" : "text-muted-foreground"}>{item.label}</span>
                </div>
              ))}
            </div>
            {w.busy && <p className="text-xs text-primary font-semibold">{t("wizard.executing", { namespace: "openingBalance" })}</p>}
          </div>
        );
      }
      case 9:
        return renderDone();
      default:
        return null;
    }
  };

  // ── Live opening-position summary (§13) derived from wizard state ─────────
  const summary = useMemo(() => {
    const cash = sumLines(w.cashBanks.filter((l) => l.kind === "cash"));
    const bank = sumLines(w.cashBanks.filter((l) => l.kind === "bank"));
    const receivables = sumLines(w.derivedAr) + sumLines(w.arManualLines);
    const inventory = w.inventoryTotal;
    const fixedAssets = sumLines(w.faRows);
    const suppliers = sumLines(w.derivedAp);
    const loans = sumLines(w.loans);
    const otherLiabilities = sumLines(w.liabilitiesManual);
    const partnerCapital = sumLines(w.partnerEquity);
    const partnerCurrent = sumLines(w.partnerCurrentManual);
    const otherEquity = sumLines(w.equityManual);

    const totalAssets = cash + bank + receivables + inventory + fixedAssets;
    const totalLiabilities = suppliers + loans + otherLiabilities;
    const recognizedEquity = partnerCapital + partnerCurrent + otherEquity;
    const residual = totalAssets - totalLiabilities - recognizedEquity;

    // Smart, section-targeted hints (§14): tell the accountant WHICH section
    // needs fixing and by how much, never "journal line 17 is invalid".
    const hints: string[] = [];
    if (residual > 0.01) {
      hints.push(t("wizard.hintAssetsExceed", { namespace: "openingBalance", vars: { diff: toFixed(residual, 2) } }));
    } else if (residual < -0.01) {
      hints.push(t("wizard.hintLiabilitiesExceed", { namespace: "openingBalance", vars: { diff: toFixed(-residual, 2) } }));
    }
    for (const r of w.derivedAr) {
      if (toNum(r.amount) > 0 && !r.account_id) {
        hints.push(t("wizard.hintCustomerMissingAccount", { namespace: "openingBalance", vars: { name: r.label, amount: fmtMoney(r.amount) } }));
      }
    }
    for (const r of w.derivedAp) {
      if (toNum(r.amount) > 0 && !r.account_id) {
        hints.push(t("wizard.hintSupplierMissingAccount", { namespace: "openingBalance", vars: { name: r.label, amount: fmtMoney(r.amount) } }));
      }
    }
    if (w.reconciliation && !w.reconciliation.all_reconciled) {
      for (const row of w.reconciliation.rows) {
        if (toNum(row.subledger) !== toNum(row.general_ledger)) {
          hints.push(
            t("wizard.hintReconMismatch", { namespace: "openingBalance", vars: { label: RECON_ROW_LABEL[row.key]?.(t) || row.key, subledger: fmtMoney(row.subledger), gl: fmtMoney(row.general_ledger) } }),
          );
        }
      }
    }
    hints.push(...inventoryMismatchHints(w.effectiveInventory, w.materials, t));
    // Amounts entered on rows that resolved no ledger account: they would be
    // silently dropped from the saved lines while still counting in the
    // section totals — the exact source of the GL ≠ wizard mismatch.
    for (const hint of w.missingAccountHints) {
      hints.push(t("wizard.hintMissingAccount", { namespace: "openingBalance", vars: { hint } }));
    }

    return {
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
      hints,
    };
  }, [w.cashBanks, w.derivedAr, w.arManualLines, w.inventoryTotal, w.faRows, w.derivedAp, w.loans, w.liabilitiesManual, w.partnerEquity, w.partnerCurrentManual, w.equityManual, w.reconciliation, w.effectiveInventory, w.materials, w.missingAccountHints, t]);

  // ── Progress checklist (§15): a direct mirror of the wizard's own stepper —
  // same labels, same dynamic order (stepOrder), same done-state
  // (completedSteps) — so the two can never drift apart.
  const checklistItems: ChecklistItem[] = useMemo(
    () =>
      w.stepOrder.map((idx) => ({
        key: w.steps[idx]?.id ?? String(idx),
        label: w.steps[idx]?.label ?? "",
        done: w.completedSteps.has(idx),
      })),
    [w.stepOrder, w.steps, w.completedSteps],
  );

  // Use stepOrder from the hook (single source of truth).
  const stepOrder = w.stepOrder;

  const wizard = (
    <WizardShell
      title={isNew ? t("wizard.titleNew", { namespace: "openingBalance" }) : t("wizard.titleExisting", { namespace: "openingBalance" })}
      subtitle={isNew
        ? t("wizard.subtitleNew", { namespace: "openingBalance" })
        : t("wizard.subtitleExisting", { namespace: "openingBalance" })}
      steps={w.steps}
      stepIndex={w.step}
      stepOrder={stepOrder}
      canNext={w.canNext}
      canPrev={w.canPrev}
      isNexting={w.busy}
      isFinal={w.step === w.steps.length - 1}
      nextLabel={w.nextLabel}
      canNextHint={w.nextDisabledReason}
      onNext={handleNext}
      onPrev={w.handlePrev}
      onStepClick={w.navigateToStep}
      canNavigateToStep={w.canNavigateToStep}
      completedSteps={completedSteps}
    >
      {renderStep()}
    </WizardShell>
  );

  // Once the migration is sealed the opening position summary / progress
  // checklist are opening controls — no longer relevant. The wizard shows only
  // the post-transition onboarding.
  if (isNew || w.migration?.status === "Locked") return wizard;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-4 items-start" dir="rtl">
      {wizard}
      <aside className="lg:sticky lg:top-4 space-y-3 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto custom-scrollbar">
        <OpeningPositionSummary {...summary} plugAmount={w.totals.plugAmount} balanced={w.savedTotals.balanced} />
        <OpeningProgressChecklist items={checklistItems} />
      </aside>
    </div>
  );
}

function InlineRows({
  title,
  rows,
  onSave,
  onDelete,
  label,
  nativeHint,
  addForm,
}: {
  title: string;
  rows: DerivedRow[];
  onSave: (row: DerivedRow, value: string) => Promise<boolean>;
  onDelete?: (row: DerivedRow) => void;
  label: string;
  nativeHint?: "debit" | "credit";
  addForm?: React.ReactNode;
}) {
  const { t } = useLocalization();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">{title}</span>
        {rows.some((r) => parseFloat(r.amount) > 0) && (
          <span className="rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-xs font-bold text-success tabular-nums">
            {rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0).toFixed(2)}
          </span>
        )}
      </div>
      {rows.length === 0 && !addForm ? (
        <p className="text-xs text-muted-foreground py-1.5">{t("wizard.noDerivedLines", { namespace: "openingBalance" })}</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border bg-muted/40">
          {rows.map((r) => (
            <InlineBalanceRow
              key={r.key}
              row={r}
              onSave={onSave}
              onDelete={onDelete}
              label={label}
              nativeHint={nativeHint}
            />
          ))}
          {addForm}
        </div>
      )}
    </div>
  );
}

function FirstPeriodFields({
  start,
  end,
  onStart,
  onEnd,
  created,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  created: { start_date: string; end_date: string } | null;
}) {
  const { t } = useLocalization();
  return (
    <div className="space-y-1.5">
      <div className="rounded-lg border border-primary/20 bg-primary/10/60 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-indigo-700">{t("wizard.firstPeriodHint", { namespace: "openingBalance" })}</p>
        <p className="text-xs text-indigo-600">
          {t("wizard.firstPeriodDesc", { namespace: "openingBalance" })}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="wiz-period-start" required>{t("wizard.periodStart", { namespace: "openingBalance" })}</FieldLabel>
          <Input id="wiz-period-start" type="date" value={start} onChange={(e) => onStart(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="wiz-period-end" required>{t("wizard.periodEnd", { namespace: "openingBalance" })}</FieldLabel>
          <Input id="wiz-period-end" type="date" value={end} onChange={(e) => onEnd(e.target.value)} className="h-9" />
        </div>
      </div>
      {created && (
        <div className="rounded-lg p-3 text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
          {t("wizard.periodCreated", { namespace: "openingBalance" })}{toLocalDateStr(created.start_date)} ← {toLocalDateStr(created.end_date)}
        </div>
      )}
    </div>
  );
}

// ── Residual classification: the user picks the ACCOUNTING MEANING, the system
// picks the designated account. Classification cards replace the raw
// drop-down; the account is only chosen explicitly in Advanced mode, filtered
// to the classification's controlled purposes. UnresolvedDifference blocks
// posting/locking and never carries an account.
export function ResidualClassificationSection({
  residual,
  plugAmount,
  specs,
  value,
  onValueChange,
  residualAccountId,
  onResidualAccountChange,
  accounts,
  spec,
}: {
  residual: number;
  plugAmount: number;
  specs: ResidualClassificationSpecDto[];
  value: string;
  onValueChange: (key: string) => void;
  residualAccountId: string;
  onResidualAccountChange: (accountId: string) => void;
  accounts: AccountDto[];
  spec: ResidualClassificationSpecDto | undefined;
}) {
  const { t } = useLocalization();
  const [advanced, setAdvanced] = useState(false);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const confirmSpec = specs.find((s) => s.key === confirmKey);

  const apply = (key: string) => {
    onValueChange(key);
    setAdvanced(false);
  };

  const onPick = (key: string) => {
    if (key === value) return;
    const candidate = specs.find((s) => s.key === key);
    if (candidate?.requires_confirmation) {
      setConfirmKey(key);
      return;
    }
    apply(key);
  };

  const effectiveAccount = accounts.find((a) => a.id === residualAccountId);
  const advancedOptions = spec
    ? accounts.filter(
        (a) =>
          a.account_type === "Equity" &&
          (a.purpose ? spec.allowed_purposes.includes(a.purpose) : false) &&
          a.is_active,
      )
    : [];

  return (
    <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 space-y-3">
      <p className="text-xs font-semibold text-warning">
        {t("wizard.residualTitle", { namespace: "openingBalance", vars: { amount: toFixed(residual, 2) } })}
      </p>
      {residual > 0 ? (
        <p className="text-xs text-warning">
          {t("wizard.residualPositiveDesc", { namespace: "openingBalance" })}
        </p>
      ) : (
        <p className="text-xs text-warning">
          {t("wizard.residualNegativeDesc", { namespace: "openingBalance" })}
        </p>
      )}

      {residual > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={t("wizard.residualClassificationAria", { namespace: "openingBalance" })}>
            {specs.map((s) => {
              const selected = s.key === value;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onPick(s.key)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-accent",
                    !s.allows_posting && "text-destructive",
                  )}
                >
                  <span className="truncate">{s.label_ar}</span>
                  {selected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>

          {value === "UnresolvedDifference" && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10/70 p-3 space-y-1">
              <p className="text-xs font-bold text-destructive">
                {t("wizard.unresolvedDiffTitle", { namespace: "openingBalance" })}
              </p>
              <p className="text-xs text-destructive">
                {t("wizard.unresolvedDiffDesc", { namespace: "openingBalance" })}
              </p>
            </div>
          )}

          {value !== "" && value !== "UnresolvedDifference" && (
            <div className="rounded-lg border border-primary/20 bg-card p-3 space-y-1.5">
              <p className="text-xs font-semibold text-primary">{t("wizard.previewBeforeSave", { namespace: "openingBalance" })}</p>
              {plugAmount !== 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("wizard.previewValue", { namespace: "openingBalance", vars: { amount: toFixed(plugAmount, 2), type: spec?.label_ar ?? value } })}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{spec?.treatment_ar ?? ""}</p>
              {(spec?.designated_account || effectiveAccount) && (
                <p className="text-xs text-muted-foreground">
                  {t("wizard.designatedAccount", { namespace: "openingBalance" })}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                      {(spec?.designated_account ?? effectiveAccount)?.code ?? ""}
                    </span>
                    <span className="font-bold text-foreground">
                      {(spec?.designated_account ?? effectiveAccount)?.name_ar ?? ""}
                    </span>
                  </span>
                </p>
              )}
            </div>
          )}

          {value === "RetainedEarnings" && plugAmount !== 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50/70 p-3 space-y-1">
              <p className="text-xs font-bold text-green-700">
                {t("wizard.classifiedAsRetained", { namespace: "openingBalance", vars: { amount: toFixed(plugAmount, 2) } })}
              </p>
              <p className="text-xs text-green-600">
                {t("wizard.classifiedAsRetainedDesc", { namespace: "openingBalance" })}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 justify-between pt-0.5">
            <button
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              className="text-[11px] font-semibold text-muted-foreground underline decoration-dotted hover:text-foreground"
              aria-expanded={advanced}
            >
              {advanced ? t("wizard.advancedModeClose", { namespace: "openingBalance" }) : t("wizard.advancedModeToggle", { namespace: "openingBalance" })}
            </button>
            {advanced && (
              <div className="w-full md:max-w-xs">
                <AccountCombobox
                  accounts={accounts}
                  options={advancedOptions}
                  value={residualAccountId}
                  onValueChange={onResidualAccountChange}
                  placeholder={t("wizard.advancedPlaceholder", { namespace: "openingBalance" })}
                  emptyText={t("wizard.advancedEmpty", { namespace: "openingBalance" })}
                  disabled={value === "" || value === "UnresolvedDifference" || advancedOptions.length === 0}
                />
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmKey !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmKey(null);
        }}
        title={t("wizard.confirmClassificationTitle", { namespace: "openingBalance", vars: { label: confirmSpec?.label_ar ?? "" } })}
        description={t("wizard.confirmClassificationDesc", { namespace: "openingBalance" })}
        confirmLabel={t("wizard.confirmClassificationLabel", { namespace: "openingBalance" })}
        cancelLabel="إلغاء"
        onConfirm={() => {
          if (confirmKey) apply(confirmKey);
          setConfirmKey(null);
        }}
      />
    </div>
  );
}

// ── Negative residual: when liabilities + equity > assets (debit residual), the
// accountant must add manual debit lines to balance the entry. This section
// provides an inline editor directly in the Review step.
function NegativeResidualSection({
  residual,
  manualLines,
  onAdd,
  onUpdate,
  onRemove,
  accounts,
  detailAccounts,
}: {
  residual: number;
  manualLines: WizLine[];
  onAdd: () => void;
  onUpdate: (key: string, patch: Partial<WizLine>) => void;
  onRemove: (key: string) => void;
  accounts: AccountDto[];
  detailAccounts: AccountDto[];
}) {
  const { t } = useLocalization();
  const total = sumLines(manualLines);
  const balanced = Math.abs(residual + total) < 0.01;
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10/60 p-3 space-y-3">
      <p className="text-xs font-semibold text-destructive">
        {t("wizard.negativeResidualTitle", { namespace: "openingBalance", vars: { amount: toFixed(residual, 2) } })}
      </p>
      <p className="text-xs text-destructive">
        {t("wizard.negativeResidualDesc", { namespace: "openingBalance" })}
      </p>
      <NegativeManualLinesEditor
        lines={manualLines}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemove={onRemove}
        accounts={accounts}
        detailAccounts={detailAccounts}
      />
      {manualLines.length > 0 && (
        <div className={"rounded-lg p-2 text-xs font-semibold " + (balanced ? "bg-green-50 text-green-700" : "bg-warning/10 text-warning")}>
          {balanced
            ? t("wizard.balancedAfterAdd", { namespace: "openingBalance", vars: { diff: toFixed(residual + total, 2) } })
            : t("wizard.unbalancedAfterAdd", { namespace: "openingBalance", vars: { diff: toFixed(residual + total, 2) } })}
        </div>
      )}
    </div>
  );
}

// ── Inline editor for negative-residual manual debit lines.
function NegativeManualLinesEditor({
  lines,
  onAdd,
  onUpdate,
  onRemove,
  accounts,
  detailAccounts,
}: {
  lines: WizLine[];
  onAdd: () => void;
  onUpdate: (key: string, patch: Partial<WizLine>) => void;
  onRemove: (key: string) => void;
  accounts: AccountDto[];
  detailAccounts: AccountDto[];
}) {
  const { t } = useLocalization();
  return (
    <div className="space-y-2">
      {lines.map((l) => {
        const amountNum = parseFloat(l.amount);
        const amountInvalid = l.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);
        return (
          <AccountLineRow
            key={l.key}
            accountId={l.account_id}
            onAccountChange={(id) => onUpdate(l.key, { account_id: id })}
            amount={l.amount}
            onAmountChange={(amount) => onUpdate(l.key, { amount })}
            onRemove={() => onRemove(l.key)}
            accounts={accounts}
            options={detailAccounts}
            placeholder={t("wizard.assetAccountPlaceholder", { namespace: "openingBalance" })}
            showErrorMessage={amountInvalid}
          />
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        className="w-full border-dashed border-red-300 text-destructive hover:bg-red-50 font-bold"
      >
        {t("wizard.addDebitLine", { namespace: "openingBalance" })}
      </Button>
    </div>
  );
}
