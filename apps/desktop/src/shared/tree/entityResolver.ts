import { SYSTEM_ACCOUNT_IDS, type AccountDto } from "@erp/shared-types";
import {
  detectFixedAssetTypeFromName,
  FIXED_ASSET_TYPE_BY_ACCOUNT_ID,
  type FixedAssetType,
} from "./fixedAssetTypes";
import type {
  ResolvedTreeNode,
  TreeNodeBranch,
  TreeNodeCreatePanelKind,
  TreeNodeEntityType,
} from "./nodeTypes";

export type { FixedAssetType };

/**
 * CENTRAL node resolver — the single place that classifies an account node and
 * derives its capabilities. It intentionally avoids name/code string matching
 * and relies on semantic data: `account_type`, `category`, `is_final`,
 * `linked_customer_id`/`linked_supplier_id`, `purpose` and stable system ids.
 *
 * Both the Chart of Accounts page and the shared action resolver consume this,
 * so a classification change is applied everywhere at once.
 */

const PARTNER_PURPOSES = new Set([
  "partner_capital",
  "partner_drawings",
  "partner_current",
]);

/** Stable ids of accounts created/owned by the fixed-assets workflow. */
const FIXED_ASSET_ACCOUNT_IDS = new Set<string>([
  SYSTEM_ACCOUNT_IDS.FIXED_ASSET_BUILDINGS,
  SYSTEM_ACCOUNT_IDS.FIXED_ASSET_AUTOMOTIVE,
  SYSTEM_ACCOUNT_IDS.FIXED_ASSET_EQUIPMENT,
  SYSTEM_ACCOUNT_IDS.FIXED_ASSET_FURNITURE,
  SYSTEM_ACCOUNT_IDS.ACCUMULATED_DEPRECIATION_AUTOMOTIVE,
  SYSTEM_ACCOUNT_IDS.ACCUMULATED_DEPRECIATION_EQUIPMENT,
  SYSTEM_ACCOUNT_IDS.ACCUMULATED_DEPRECIATION_FURNITURE,
  SYSTEM_ACCOUNT_IDS.DEPRECIATION_EXPENSE_AUTOMOTIVE,
  SYSTEM_ACCOUNT_IDS.DEPRECIATION_EXPENSE_EQUIPMENT,
  SYSTEM_ACCOUNT_IDS.DEPRECIATION_EXPENSE_FURNITURE,
  SYSTEM_ACCOUNT_IDS.DEPRECIATION_EXPENSE,
]);

export interface ResolveAccountNodeContext {
  /** The node to resolve (a real account). Null maps to the invisible root. */
  node: AccountDto | null;
  /** Full flat list of accounts (for ancestor/subtree walks). */
  nodes: AccountDto[];
  /** Virtual root sentinel id used by the page. */
  rootId?: string;
}

/** Id chain from the node up to its roots (includes the node itself). */
function ancestorIds(node: AccountDto, nodes: AccountDto[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let current: AccountDto | null = node;
  let guard = 0;
  while (current && !seen.has(current.id) && guard < 64) {
    seen.add(current.id);
    ids.push(current.id);
    current = current.parent_id ? (nodes.find((n) => n.id === current?.parent_id) ?? null) : null;
    guard += 1;
  }
  return ids;
}

/** True when any descendant (parent_id links) of `node` is a fixed-asset account. */
function hasFixedAssetDescendant(node: AccountDto, nodes: AccountDto[]): boolean {
  const childrenOf = new Map<string, AccountDto[]>();
  for (const a of nodes) {
    if (!a.parent_id) continue;
    const list = childrenOf.get(a.parent_id);
    if (list) list.push(a);
    else childrenOf.set(a.parent_id, [a]);
  }
  const queue = [node.id];
  const seen = new Set<string>([node.id]);
  while (queue.length > 0) {
    const id = queue.pop()!;
    const children = childrenOf.get(id);
    if (!children) continue;
    for (const child of children) {
      if (FIXED_ASSET_ACCOUNT_IDS.has(child.id) || child.purpose === "fixed_asset") return true;
      if (!seen.has(child.id)) {
        seen.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return false;
}

function resolveBranch(node: AccountDto, nodes: AccountDto[]): TreeNodeBranch {
  if (node.linked_customer_id) return "customers";
  if (node.linked_supplier_id) return "suppliers";
  const ancestors = ancestorIds(node, nodes);
  const isFixedAssets =
    FIXED_ASSET_ACCOUNT_IDS.has(node.id) ||
    node.purpose === "fixed_asset" ||
    ancestors.some((id) => FIXED_ASSET_ACCOUNT_IDS.has(id)) ||
    ancestors.some((id) => nodes.find((n) => n.id === id)?.purpose === "fixed_asset") ||
    hasFixedAssetDescendant(node, nodes);
  if (isFixedAssets) return "fixed-assets";
  if (ancestors.includes(SYSTEM_ACCOUNT_IDS.CUSTOMERS)) return "customers";
  if (ancestors.includes(SYSTEM_ACCOUNT_IDS.SUPPLIERS)) return "suppliers";
  if (ancestors.includes(SYSTEM_ACCOUNT_IDS.OTHER_EXPENSES)) return "expenses";
  if (
    ancestors.includes(SYSTEM_ACCOUNT_IDS.CAPITAL) ||
    ancestors.includes(SYSTEM_ACCOUNT_IDS.DRAWINGS) ||
    (node.purpose !== undefined && PARTNER_PURPOSES.has(node.purpose))
  ) {
    return "partners";
  }
  return "general";
}

function createPanelKindFor(branch: TreeNodeBranch): TreeNodeCreatePanelKind {
  switch (branch) {
    case "customers":
      return "customer";
    case "suppliers":
      return "supplier";
    case "expenses":
      return "expense-item";
    case "fixed-assets":
      return "fixed-asset";
    case "partners":
      return "partner";
    case "general":
      return "account";
  }
}

function entityTypeFor(
  node: AccountDto,
  branch: TreeNodeBranch,
): TreeNodeEntityType {
  if (node.purpose === "fixed_asset") return "fixed-asset-account";
  if (node.linked_customer_id) return "customer-account";
  if (node.linked_supplier_id) return "supplier-account";
  if (branch === "expenses") return "expense-account";
  if (branch === "partners") return "partner-account";
  if (node.category === "Detail" && node.is_final) return "account";
  return "account-group";
}

function partnerRoleFor(node: AccountDto): "capital" | "drawings" | "current" | null {
  switch (node.purpose) {
    case "partner_capital":
      return "capital";
    case "partner_drawings":
      return "drawings";
    case "partner_current":
      return "current";
    default:
      return null;
  }
}

/**
 * Infer the fixed-asset subtype (نوع الأصل) implied by a fixed-assets node:
 * exact account id → ancestor asset-type account → name keywords. Returns null
 * when the node does not map to one of the four asset types (e.g. the "الأصول
 * الثابتة" parent group, which groups multiple types).
 */
export function inferFixedAssetType(node: AccountDto, nodes: AccountDto[]): FixedAssetType | null {
  const byId = FIXED_ASSET_TYPE_BY_ACCOUNT_ID[node.id];
  if (byId) return byId;
  for (const id of ancestorIds(node, nodes)) {
    const type = FIXED_ASSET_TYPE_BY_ACCOUNT_ID[id];
    if (type) return type;
  }
  return (
    detectFixedAssetTypeFromName(node.name_ar) ??
    detectFixedAssetTypeFromName(node.name_en)
  );
}

/**
 * Resolve an account node into its semantic classification + capabilities.
 * The virtual root (or a null node) yields an inert node with no operations.
 */
export function resolveAccountNode(ctx: ResolveAccountNodeContext): ResolvedTreeNode {
  const { node, nodes, rootId } = ctx;
  if (!node || node.id === rootId) {
    return {
      entityType: "root",
      branch: "general",
      capabilities: {
        canCreate: false,
        createPanelKind: null,
        canEdit: false,
        canDelete: false,
        canViewLedger: false,
      },
      linkedEntityId: null,
    };
  }

  const branch = resolveBranch(node, nodes);
  const entityType = entityTypeFor(node, branch);

  return {
    entityType,
    branch,
    capabilities: {
      canCreate: true,
      createPanelKind: createPanelKindFor(branch),
      canEdit: true,
      canDelete: true,
      canViewLedger: true,
    },
    linkedEntityId:
      node.linked_customer_id ?? node.linked_supplier_id ?? null,
    linkedPartnerRole: branch === "partners" ? partnerRoleFor(node) : null,
  };
}

export { FIXED_ASSET_ACCOUNT_IDS, PARTNER_PURPOSES };