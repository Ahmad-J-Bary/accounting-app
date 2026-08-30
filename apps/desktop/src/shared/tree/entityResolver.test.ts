import { describe, expect, it } from "vitest";
import { SYSTEM_ACCOUNT_IDS, type AccountDto } from "@erp/shared-types";
import { resolveAccountNode, inferFixedAssetType } from "./entityResolver";
import { resolveAccountNodeActions } from "./actionsResolver";
import { CREATE_LABELS } from "./actionsResolver";

const ROOT_ID = "__chart_of_accounts_root__";

function account(partial: Partial<AccountDto> & { id: string }): AccountDto {
  return {
    code: "",
    name_ar: "",
    name_en: "",
    account_type: "Assets",
    parent_id: null,
    category: "Summary",
    level: 1,
    opening_balance: "0",
    balance: "0",
    notes: null,
    is_active: true,
    is_default: false,
    is_final: false,
    linked_customer_id: null,
    linked_supplier_id: null,
    debit: "0",
    credit: "0",
    ...partial,
  };
}

describe("resolveAccountNode — root", () => {
  it("returns an inert root node with no capabilities", () => {
    const root = account({ id: ROOT_ID });
    const resolved = resolveAccountNode({ node: root, nodes: [root], rootId: ROOT_ID });

    expect(resolved.entityType).toBe("root");
    expect(resolved.capabilities.canCreate).toBe(false);
    expect(resolved.capabilities.canEdit).toBe(false);
    expect(resolved.capabilities.canViewLedger).toBe(false);
    expect(resolveAccountNodeActions({ resolved }).length).toBe(0);
  });
});

describe("resolveAccountNode — general branch", () => {
  it("classifies a summary group as account-group with new child account", () => {
    const group = account({ id: "g1", category: "Summary", name_ar: "الأصول" });
    const resolved = resolveAccountNode({ node: group, nodes: [group], rootId: ROOT_ID });

    expect(resolved.branch).toBe("general");
    expect(resolved.entityType).toBe("account-group");
    expect(resolved.capabilities.canCreate).toBe(true);
    expect(resolved.capabilities.createPanelKind).toBe("account");
    expect(resolved.capabilities.canViewLedger).toBe(true);
  });

  it("classifies a posting account with ledger access", () => {
    const accountNode = account({
      id: "1202",
      category: "Detail",
      is_final: true,
      name_ar: "الصندوق",
    });
    const resolved = resolveAccountNode({
      node: accountNode,
      nodes: [accountNode],
      rootId: ROOT_ID,
    });

    expect(resolved.capabilities.canViewLedger).toBe(true);
    const actions = resolveAccountNodeActions({ resolved });
    expect(actions.map((a) => a.key)).toEqual(["new", "edit", "ledger", "delete"]);
    expect(actions[0].label).toBe(CREATE_LABELS.account);
  });
});

describe("resolveAccountNode — operational branches", () => {
  const branches = [
    {
      name: "customers",
      parentId: SYSTEM_ACCOUNT_IDS.CUSTOMERS,
      linked: (n: AccountDto) => ({ linked_customer_id: "c1" }),
      createKind: "customer",
    },
    {
      name: "suppliers",
      parentId: SYSTEM_ACCOUNT_IDS.SUPPLIERS,
      linked: (n: AccountDto) => ({ linked_supplier_id: "s1" }),
      createKind: "supplier",
    },
    {
      name: "expenses",
      parentId: SYSTEM_ACCOUNT_IDS.OTHER_EXPENSES,
      linked: () => ({}),
      createKind: "expense-item",
    },
  ] as const;

  for (const branch of branches) {
    it(`maps a node under ${branch.name} to its entity-specific new form`, () => {
      const [root, node] = [
        account({ id: branch.parentId, name_ar: branch.name }),
        account({
          id: `${branch.parentId}-1`,
          parent_id: branch.parentId,
          category: "Detail",
          is_final: true,
          ...branch.linked(account({ id: "x" })),
        }),
      ];
      const resolved = resolveAccountNode({ node, nodes: [root, node], rootId: ROOT_ID });

      expect(resolved.branch).toBe(branch.name);
      expect(resolved.capabilities.createPanelKind).toBe(branch.createKind);
      const actions = resolveAccountNodeActions({ resolved });
      const newAction = actions.find((a) => a.key === "new");
      expect(newAction?.label).toBe(CREATE_LABELS[branch.createKind]);
    });
  }

  it("classifies a fixed-asset account (id-based) into the fixed-assets branch", () => {
    const node = account({
      id: SYSTEM_ACCOUNT_IDS.FIXED_ASSET_EQUIPMENT,
      name_ar: "معدات وتجهيزات",
    });
    const resolved = resolveAccountNode({ node, nodes: [node], rootId: ROOT_ID });

    expect(resolved.branch).toBe("fixed-assets");
    expect(resolved.capabilities.createPanelKind).toBe("fixed-asset");
  });

  it("classifies a summary group containing fixed-asset accounts into the fixed-assets branch", () => {
    const group = account({ id: "assets-fixed", name_ar: "الأصول الثابتة" });
    const child = account({
      id: SYSTEM_ACCOUNT_IDS.FIXED_ASSET_FURNITURE,
      parent_id: group.id,
      name_ar: "أثاث",
    });
    const resolved = resolveAccountNode({
      node: group,
      nodes: [group, child],
      rootId: ROOT_ID,
    });

    expect(resolved.branch).toBe("fixed-assets");
    expect(resolved.capabilities.createPanelKind).toBe("fixed-asset");
  });

  it("classifies a partner account (purpose-based) into the partners branch", () => {
    const node = account({
      id: "5101",
      account_type: "Equity",
      purpose: "partner_capital",
      name_ar: "رأس مال",
    });
    const resolved = resolveAccountNode({ node, nodes: [node], rootId: ROOT_ID });

    expect(resolved.branch).toBe("partners");
    expect(resolved.capabilities.createPanelKind).toBe("partner");
  });
});

describe("inferFixedAssetType — implied asset subtype", () => {
  const FIXED_ID = SYSTEM_ACCOUNT_IDS.FIXED_ASSET_BUILDINGS;

  it("maps an exact asset-type account id to its subtype", () => {
    const node = account({ id: SYSTEM_ACCOUNT_IDS.FIXED_ASSET_AUTOMOTIVE, name_ar: "آليات ومركبات" });
    expect(inferFixedAssetType(node, [node])).toBe("automotive");
  });

  it("maps a descendant account to its ancestor asset-type subtype", () => {
    const parent = account({ id: FIXED_ID, name_ar: "أبنية وأراضي" });
    const child = account({ id: "1101-1", parent_id: parent.id, name_ar: "مبنى الإدارة" });
    expect(inferFixedAssetType(child, [parent, child])).toBe("buildings_land");
  });

  it("returns null for the fixed-assets parent group (type is ambiguous)", () => {
    const group = account({ id: "11", purpose: "fixed_asset", name_ar: "الأصول الثابتة" });
    const child = account({ id: FIXED_ID, parent_id: group.id, name_ar: "أبنية وأراضي" });
    expect(inferFixedAssetType(group, [group, child])).toBeNull();
  });

  it("falls back to name keywords for custom fixed-asset accounts", () => {
    const node = account({ id: "x", purpose: "fixed_asset", name_ar: "معدات مكتبية", name_en: "" });
    expect(inferFixedAssetType(node, [node])).toBe("equipment");
  });

  it("returns null for non fixed-asset accounts", () => {
    const node = account({ id: "1202", name_ar: "الصندوق" });
    expect(inferFixedAssetType(node, [node])).toBeNull();
  });
});

describe("resolveAccountNode — partner account roles", () => {
  for (const [purpose, role] of [
    ["partner_capital", "capital"],
    ["partner_drawings", "drawings"],
    ["partner_current", "current"],
  ] as const) {
    it(`maps purpose ${purpose} to role ${role}`, () => {
      const node = account({ id: `acc-${role}`, account_type: "Equity", purpose });
      const resolved = resolveAccountNode({ node, nodes: [node], rootId: ROOT_ID });
      expect(resolved.linkedPartnerRole).toBe(role);
    });
  }

  it("leaves linkedPartnerRole null for a linked customer account", () => {
    const node = account({
      id: "1230-1",
      linked_customer_id: "c1",
      parent_id: SYSTEM_ACCOUNT_IDS.CUSTOMERS,
    });
    const resolved = resolveAccountNode({ node, nodes: [node], rootId: ROOT_ID });
    expect(resolved.linkedPartnerRole).toBeNull();
    expect(resolved.linkedEntityId).toBe("c1");
  });
});