import { lazy, Suspense } from "react";
import type { AccountDto, CurrencyDto } from "@erp/shared-types";
import type { PartnerFormPayload } from "@modules/partners/components/PartnerFormPanel";
import type { ExpenseFormPayload } from "@modules/expenses/components/ExpenseFormPanel";
import type { PartnerRequest } from "@modules/partners/api/partnerService";
import type { TreeNodeCreatePanelKind, ResolvedTreeNode } from "@shared/tree/nodeTypes";
import type { FixedAssetType } from "@shared/tree/fixedAssetTypes";
import { AccountPanel } from "./AccountPanel";
import { useLinkedPartner } from "../hooks/useLinkedEntity";

/*
 * Lazy entity create panels for the Chart of Accounts branches. Entity forms
 * are loaded on demand (React.lazy) so opening the COA page never pulls in the
 * partner / expenses / fixed-assets modules (Phase 24/30).
 */

const PartnerFormPanelLazy = lazy(() =>
  import("@modules/partners/components/PartnerFormPanel").then((m) => ({
    default: m.PartnerFormPanel,
  })),
);
const ExpenseFormPanelLazy = lazy(() =>
  import("@modules/expenses/components/ExpenseFormPanel").then((m) => ({
    default: m.ExpenseFormPanel,
  })),
);
const FixedAssetFormLazy = lazy(() =>
  import("@modules/fixed-assets/components/FixedAssetForm").then((m) => ({
    default: m.FixedAssetForm,
  })),
);
const PartnerFormLazy = lazy(() =>
  import("@modules/partners/components/PartnerForm").then((m) => ({
    default: m.PartnerForm,
  })),
);

function LazyFallback() {
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
    </div>
  );
}

export type PanelMode = "view" | "edit" | "create";

interface BranchPanelProps {
  mode: PanelMode;
  createKind: TreeNodeCreatePanelKind | null;
  selected: AccountDto | null;
  allAccounts: AccountDto[];
  /** Resolved classification of the selected node (badge in view mode). */
  resolved?: ResolvedTreeNode | null;
  parentName?: string | null;
  parentAccount: AccountDto | null;
  /** Children accounts of the "مصاريف أخرى" parent (for expense create). */
  expenseItems: AccountDto[];
  /** Parent account code prefix of "مصاريف أخرى" (for expense create). */
  expenseParentCode?: string;
  /** Currency list forwarded to the FixedAssetForm. */
  currencies: CurrencyDto[];
  /** Fixed-asset subtype implied by the selected asset account (locks the field). */
  initialFixedAssetType?: FixedAssetType | null;
  entitySaving: boolean;
  onClose: () => void;
  onSavedAccount: () => void | Promise<void>;
  onCreateCustomer: (payload: PartnerFormPayload) => Promise<void>;
  onCreateSupplier: (payload: PartnerFormPayload) => Promise<void>;
  onCreateExpense: (payload: ExpenseFormPayload) => Promise<void>;
  onCreatePartner: (payload: PartnerRequest) => Promise<void>;
  onAssetSaved: () => Promise<void>;
}

/**
 * Side-panel content of the Chart of Accounts: delegates to the existing
 * AccountPanel for view/account edit/account create, and to the lazily loaded
 * entity forms for branch-specific creation (customer, supplier, expense item,
 * fixed asset, partner).
 */
export function BranchPanel({
  mode,
  createKind,
  selected,
  allAccounts,
  resolved,
  parentName,
  parentAccount,
  expenseItems,
  expenseParentCode,
  currencies,
  initialFixedAssetType,
  entitySaving,
  onClose,
  onSavedAccount,
  onCreateCustomer,
  onCreateSupplier,
  onCreateExpense,
  onCreatePartner,
  onAssetSaved,
}: BranchPanelProps) {
  const isCapitalPartnerEdit =
    mode === "edit" &&
    resolved?.entityType === "partner-account" &&
    (resolved.linkedPartnerRole === "capital" || !resolved.linkedPartnerRole);

  const partnerQuery = useLinkedPartner(
    isCapitalPartnerEdit ? selected?.id : null,
    "capital",
  );
  const linkedPartner = partnerQuery.data;

  if (mode === "create") {
    switch (createKind) {
      case "customer":
        return (
          <Suspense fallback={<LazyFallback />}>
            <PartnerFormPanelLazy
              type="customer"
              partner={null}
              accounts={allAccounts}
              onSave={onCreateCustomer}
              onClose={onClose}
              saving={entitySaving}
            />
          </Suspense>
        );
      case "supplier":
        return (
          <Suspense fallback={<LazyFallback />}>
            <PartnerFormPanelLazy
              type="supplier"
              partner={null}
              accounts={allAccounts}
              onSave={onCreateSupplier}
              onClose={onClose}
              saving={entitySaving}
            />
          </Suspense>
        );
      case "expense-item":
        return (
          <Suspense fallback={<LazyFallback />}>
            <ExpenseFormPanelLazy
              expense={null}
              expenseItems={expenseItems}
              parentCode={expenseParentCode}
              onSave={onCreateExpense}
              onClose={onClose}
              saving={entitySaving}
            />
          </Suspense>
        );
      case "fixed-asset":
        return (
          <Suspense fallback={<LazyFallback />}>
            <FixedAssetFormLazy
              currencies={currencies}
              initialAssetType={initialFixedAssetType ?? undefined}
              onClose={onClose}
              onSaved={onAssetSaved}
            />
          </Suspense>
        );
      case "partner":
        return (
          <Suspense fallback={<LazyFallback />}>
            <PartnerFormLazy
              open
              partner={null}
              onSave={onCreatePartner}
              onClose={onClose}
              saving={entitySaving}
            />
          </Suspense>
        );
      case "account":
      default:
        return (
          <AccountPanel
            mode="create"
            selected={null}
            allAccounts={allAccounts}
            parentName={parentName}
            parentAccount={parentAccount}
            onClose={onClose}
            onSaved={onSavedAccount}
          />
        );
    }
  }

  if (isCapitalPartnerEdit && linkedPartner) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <PartnerFormLazy
          open
          partner={linkedPartner}
          onSave={onCreatePartner}
          onClose={onClose}
          saving={entitySaving}
        />
      </Suspense>
    );
  }

  return (
    <AccountPanel
      mode={mode === "edit" ? "edit" : "view"}
      selected={selected}
      allAccounts={allAccounts}
      parentName={parentName}
      parentAccount={parentAccount}
      resolved={resolved}
      onClose={onClose}
      onSaved={onSavedAccount}
    />
  );
}