import { SYSTEM_ACCOUNT_IDS, type AccountDto } from "@erp/shared-types";
import {
  inferFixedAssetType,
  resolveAccountNode,
  type ResolveAccountNodeContext,
} from "./entityResolver";

export type SpecializedRouteId =
  | "fixed-assets"
  | "customers"
  | "suppliers"
  | "sales-invoices"
  | "purchase-returns"
  | "purchase-invoices"
  | "sales-returns"
  | "expenses"
  | "partners";

export type AccountNavigationTarget =
  | { type: "none" }
  | { type: "specialized-page"; routeId: SpecializedRouteId }
  | { type: "ledger"; accountId: string };

const TRADE_GROUP_ROUTE_BY_CODE: Record<string, SpecializedRouteId> = {
  "31": "sales-invoices",
  "32": "purchase-returns",
  "41": "purchase-invoices",
  "42": "sales-returns",
};

function ancestorChain(node: AccountDto, nodes: AccountDto[]): AccountDto[] {
  const chain: AccountDto[] = [];
  const seen = new Set<string>();
  let current: AccountDto | null = node;
  let guard = 0;
  while (current && !seen.has(current.id) && guard < 64) {
    seen.add(current.id);
    chain.push(current);
    current = current.parent_id
      ? (nodes.find((candidate) => candidate.id === current?.parent_id) ?? null)
      : null;
    guard += 1;
  }
  return chain;
}

function specializedRouteForNode(
  node: AccountDto,
  nodes: AccountDto[],
): SpecializedRouteId | null {
  if (node.id === SYSTEM_ACCOUNT_IDS.CUSTOMERS) return "customers";
  if (node.id === SYSTEM_ACCOUNT_IDS.SUPPLIERS) return "suppliers";
  if (node.id === SYSTEM_ACCOUNT_IDS.OTHER_EXPENSES) return "expenses";
  if (node.id === SYSTEM_ACCOUNT_IDS.CAPITAL) return "partners";
  if (node.code === "11") return "fixed-assets";

  const tradeRoute = TRADE_GROUP_ROUTE_BY_CODE[node.code];
  if (tradeRoute) return tradeRoute;

  const resolved = resolveAccountNode({ node, nodes });
  if (
    resolved.branch === "fixed-assets" &&
    resolved.entityType === "account-group" &&
    inferFixedAssetType(node, nodes) === null
  ) {
    return "fixed-assets";
  }

  return null;
}

function isInsideTradeGroup(node: AccountDto, nodes: AccountDto[]): boolean {
  return ancestorChain(node, nodes).some((account) => account.code in TRADE_GROUP_ROUTE_BY_CODE);
}

export function resolveAccountNavigation(
  ctx: ResolveAccountNodeContext,
): AccountNavigationTarget {
  const { node, nodes, rootId } = ctx;
  if (!node || node.id === rootId) return { type: "none" };

  const specializedRoute = specializedRouteForNode(node, nodes);
  if (specializedRoute) {
    return { type: "specialized-page", routeId: specializedRoute };
  }

  const resolved = resolveAccountNode(ctx);
  if (resolved.branch === "customers") {
    return { type: "ledger", accountId: node.id };
  }

  if (resolved.branch === "suppliers") {
    return { type: "ledger", accountId: node.id };
  }

  if (
    resolved.branch === "fixed-assets" ||
    resolved.branch === "expenses" ||
    resolved.branch === "partners" ||
    isInsideTradeGroup(node, nodes)
  ) {
    return { type: "ledger", accountId: node.id };
  }

  return { type: "none" };
}
