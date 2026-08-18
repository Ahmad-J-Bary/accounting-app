import type { AccountDto } from "@erp/shared-types";
import { parseSafeNumber } from "@shared/lib/parseSafeNumber";

export type BalanceSheetFilters = {
  from_date: string;
  to_date: string;
};

export type BalanceSheetRow = {
  label: string;
  value: number;
  depth: number;
  children?: BalanceSheetRow[];
};

export type BalanceSheetSection = {
  id: "fixed-assets" | "current-assets" | "fixed-liabilities" | "current-liabilities" | "equity";
  title: string;
  totalLabel: string;
  totalValue: number;
  rows: BalanceSheetRow[];
};

export type BalanceSheetComputed = {
  totalFixedAssets: number;
  totalCurrentAssets: number;
  totalAssets: number;
  totalFixedLiabilities: number;
  totalCurrentLiabilities: number;
  totalLiabilities: number;
  totalEquity: number;
  netProfit: number;
  totalDrawings: number;
  totalLiabilitiesEquity: number;
  isBalanced: boolean;
  sections: BalanceSheetSection[];
};

type AccountBalance = {
  id: string;
  code: string;
  name: string;
  balance: number;
  accountType: string;
  depth: number;
  purpose?: string;
  children: AccountBalance[];
};

function parseNum(value?: string | number | null): number {
  return parseSafeNumber(value);
}

function isPurposeOf(purpose: string | undefined, ...tags: string[]): boolean {
  return !!purpose && tags.includes(purpose);
}

function isFixedAsset(code: string, name: string, purpose?: string): boolean {
  if (isPurposeOf(purpose, "fixed_asset")) return true;
  const fixedIndicators = ["11", "ثابت", "عقار", "أرض", "مبنى", "بناء", "أبنية", "أراضي", "معدات", "تجهيز", "أثاث", "مفروش", "مجمع إهلاك"];
  if (fixedIndicators.some(i => code.startsWith(i) || name.includes(i))) return true;
  return false;
}

function isCurrentAsset(code: string, name: string, purpose?: string): boolean {
  if (isPurposeOf(purpose, "receivable", "inventory")) return true;
  const currentIndicators = ["12", "متداول", "نقد", "خزين", "صندوق", "عميل", "مدين", "زبون", "مخزون"];
  if (currentIndicators.some(i => code.startsWith(i) || name.includes(i))) return true;
  return false;
}

/** حسابات البضاعة التي يجب استثناؤها من الميزانية العمومية (تُعالَج في قائمة الدخل) */
function isInventoryTradingAccount(name: string): boolean {
  return name.includes("بضاعة أول المدة") || name.includes("بضاعة آخر المدة") || name.includes("بضاعة");
}

function isFixedLiability(code: string, name: string): boolean {
  const fixedIndicators = ["21", "ثابت", "طويل", "قرض"];
  if (fixedIndicators.some(i => code.startsWith(i) || name.includes(i))) return true;
  return false;
}

function isCurrentLiability(code: string, name: string, purpose?: string): boolean {
  if (isPurposeOf(purpose, "payable")) return true;
  const currentIndicators = ["22", "23", "24", "25", "26", "27", "28", "29", "متداول", "قصير", "مورد", "دائن", "مستحق", "تكاليف"];
  if (currentIndicators.some(i => code.startsWith(i) || name.includes(i))) return true;
  return false;
}

function buildAccountTree(
  accounts: AccountDto[],
  ledgerTotals?: Map<string, { debit: number; credit: number }>,
  parentId: string | null = null,
): AccountBalance[] {
  return accounts
    .filter(a => parentId === null ? (!a.parent_id || a.parent_id === a.id) : a.parent_id === parentId)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(acc => {
      const children = buildAccountTree(accounts, ledgerTotals, acc.id);
      let ownBalance: number;
      if (ledgerTotals) {
        const lt = ledgerTotals.get(acc.id);
        if (lt) {
          const net = lt.debit - lt.credit;
          ownBalance = ["Liabilities", "Equity", "Revenue"].includes(acc.account_type) ? -net : net;
        } else {
          ownBalance = 0;
        }
      } else {
        ownBalance = parseNum(acc.balance);
      }
      const childrenBalance = children.reduce((s, c) => s + c.balance, 0);
      const makhzoonOwn = acc.name_ar.includes("مخزون") && ownBalance !== 0;
      return {
        id: acc.id,
        code: acc.code,
        name: acc.name_ar,
        balance: makhzoonOwn ? ownBalance : children.length > 0 ? childrenBalance : ownBalance,
        accountType: acc.account_type,
        depth: 0,
        purpose: acc.purpose ?? undefined,
        children,
      };
    });
}

export function computeBalanceSheet(
  accounts: AccountDto[],
  profitLoss: { netProfit: number; totalDrawings: number },
  ledgerTotals?: Map<string, { debit: number; credit: number }>,
  inventory?: { closingInventory: number },
): BalanceSheetComputed {
  const tree = buildAccountTree(accounts, ledgerTotals);


  // --- التصنيف الصحيح: يعتمد على accountType أولاً ثم الكود/الاسم ---
  // المشكلة السابقة: "الخصوم الثابتة" كانت تُصنَّف كأصول ثابتة (يحتوي "ثابت")
  //                  "الخصوم المتداولة" كانت تُصنَّف كأصول متداولة (يحتوي "متداول")

  const fixedAssets: AccountBalance[] = [];
  const currentAssets: AccountBalance[] = [];
  const fixedLiabilities: AccountBalance[] = [];
  const currentLiabilities: AccountBalance[] = [];
  const equityList: AccountBalance[] = [];

// دالة مشتركة للتصنيف داخل نوع معين (أصول أو خصوم)
  function classifyWithinType(
    nodes: AccountBalance[],
    isFixed: (code: string, name: string, purpose?: string) => boolean,
    isCurrent: (code: string, name: string, purpose?: string) => boolean,
    fixed: AccountBalance[],
    current: AccountBalance[],
    type: string,
  ) {
    for (const node of nodes) {
      if (isInventoryTradingAccount(node.name)) continue;
      // تخطي حسابات حقوق الملكية المضمّنة داخل شجرة الخصوم
      if (node.accountType === "Equity") { equityList.push(node); continue; }
      if (isFixed(node.code, node.name, node.purpose)) { fixed.push(node); }
      else if (isCurrent(node.code, node.name, node.purpose)) { current.push(node); }
      else if (node.children.length > 0) {
        classifyWithinType(node.children, isFixed, isCurrent, fixed, current, type);
      } else {
        // حساب ورقي لا ينطبق عليه أي مصنف محدد → ضعه في المتداول افتراضياً
        current.push(node);
      }
    }
  }

  // تجميع حسابات حقوق الملكية من أي مكان في الشجرة (بما فيها المضمّنة في الخصوم)
  function collectEquityDeep(nodes: AccountBalance[]) {
    for (const node of nodes) {
      if (node.accountType === "Equity") {
        equityList.push(node);
      } else {
        collectEquityDeep(node.children);
      }
    }
  }
  collectEquityDeep(tree);

  // تصنيف الأصول (فلترة بـ accountType أولاً)
  const assetRoots = tree.filter(a => a.accountType === "Assets");
  classifyWithinType(assetRoots, isFixedAsset, isCurrentAsset, fixedAssets, currentAssets, "Assets");

  // تصنيف الخصوم (فلترة بـ accountType أولاً)
  const liabilityRoots = tree.filter(a => a.accountType === "Liabilities");
  classifyWithinType(liabilityRoots, isFixedLiability, isCurrentLiability, fixedLiabilities, currentLiabilities, "Liabilities");

  const assets = { fixed: fixedAssets, current: currentAssets };
  const liabilities = { fixed: fixedLiabilities, current: currentLiabilities };


  // --- تنظيف عميق لشجرة الأصول المتداولة ---
  const inventoryBalance = inventory?.closingInventory;
  let inventoryHandled = false;

  function deepClean(list: AccountBalance[]): AccountBalance[] {
    const cleaned: AccountBalance[] = [];
    for (const a of list) {
      if (isInventoryTradingAccount(a.name)) continue;

      if (a.name.includes("مخزون")) {
        if (!inventoryHandled) {
          cleaned.push({
            ...a,
            name: "المخزون",
            balance: inventoryBalance !== undefined && inventoryBalance !== 0 ? inventoryBalance : a.balance,
            children: [],
          });
          inventoryHandled = true;
        }
        continue;
      }

      if (a.children.length > 0) {
        const cleanedChildren = deepClean(a.children);
        const newBalance = cleanedChildren.reduce((s, c) => s + c.balance, 0);
        cleaned.push({ ...a, children: cleanedChildren, balance: newBalance });
      } else {
        cleaned.push(a);
      }
    }
    return cleaned;
  }

  assets.current = deepClean(assets.current);

  if (!inventoryHandled && inventoryBalance !== undefined && inventoryBalance !== 0) {
    assets.current.push({
      id: "__inventory__",
      code: "12-inventory",
      name: "المخزون",
      balance: inventoryBalance,
      accountType: "Assets",
      depth: 0,
      purpose: "inventory",
      children: [],
    });
  }

  const allEquity = equityList;

  function isTreeAccount(name: string): boolean {
    return name.includes("حقوق") || name.includes("ملكية") || name.includes("مدين") || name.includes("مخزون") || name.includes("دائن") || name.includes("شركاء") || name.includes("شريك") || name.includes("رأس المال") || name.includes("راس المال") || name.includes("جاري");
  }

  function accountToRow(acc: AccountBalance, depth: number = 0): BalanceSheetRow {
    return {
      label: acc.name,
      value: acc.balance,
      depth,
      children: acc.children.length > 0 ? acc.children.map(c => accountToRow(c, depth + 1)) : undefined,
    };
  }

  function isAccDep(name: string): boolean {
    return name.includes("مجمع إهلاك");
  }

  function buildSectionRows(accounts: AccountBalance[]): BalanceSheetRow[] {
    const result: BalanceSheetRow[] = [];
    function walk(list: AccountBalance[], depth: number) {
      for (const a of list) {
        if (a.children.length > 0 && isTreeAccount(a.name)) {
          result.push(accountToRow(a, depth));
        } else if (a.children.length > 0) {
          walk(a.children, depth);
        } else {
          result.push({
            label: isAccDep(a.name) ? `(-) ${a.name}` : a.name,
            value: isAccDep(a.name) ? Math.abs(a.balance) : a.balance,
            depth,
          });
        }
      }
    }
    walk(accounts, 0);
    return result;
  }

  const totalFixedAssets = assets.fixed.reduce((s, a) => s + a.balance, 0);
  const totalCurrentAssets = assets.current.reduce((s, a) => s + a.balance, 0);
  const totalAssets = totalFixedAssets + totalCurrentAssets;

  const totalFixedLiabilities = liabilities.fixed.reduce((s, a) => s + a.balance, 0);
  const totalCurrentLiabilities = liabilities.current.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = totalFixedLiabilities + totalCurrentLiabilities;

  const totalEquity = allEquity.reduce((s, a) => s + a.balance, 0) + profitLoss.netProfit - profitLoss.totalDrawings;

  const totalLiabilitiesEquity = totalLiabilities + totalEquity;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesEquity) < 0.01;

  const sections: BalanceSheetSection[] = [
    {
      id: "fixed-assets",
      title: "الأصول الثابتة",
      totalLabel: "إجمالي الأصول الثابتة",
      totalValue: totalFixedAssets,
      rows: buildSectionRows(assets.fixed),
    },
    {
      id: "current-assets",
      title: "الأصول المتداولة",
      totalLabel: "إجمالي الأصول المتداولة",
      totalValue: totalCurrentAssets,
      rows: buildSectionRows(assets.current),
    },
    {
      id: "fixed-liabilities",
      title: "الخصوم الثابتة",
      totalLabel: "إجمالي الخصوم الثابتة",
      totalValue: totalFixedLiabilities,
      rows: buildSectionRows(liabilities.fixed),
    },
    {
      id: "current-liabilities",
      title: "الخصوم المتداولة",
      totalLabel: "إجمالي الخصوم المتداولة",
      totalValue: totalCurrentLiabilities,
      rows: buildSectionRows(liabilities.current),
    },
    {
      id: "equity",
      title: "حقوق الملكية",
      totalLabel: "إجمالي حقوق الملكية",
      totalValue: totalEquity,
      rows: [
        ...buildSectionRows(allEquity),
        { label: "صافي الأرباح", value: profitLoss.netProfit, depth: 0 },
        { label: "إجمالي المسحوبات", value: -profitLoss.totalDrawings, depth: 0 },
      ],
    },
  ];

  return {
    totalFixedAssets,
    totalCurrentAssets,
    totalAssets,
    totalFixedLiabilities,
    totalCurrentLiabilities,
    totalLiabilities,
    totalEquity,
    netProfit: profitLoss.netProfit,
    totalDrawings: profitLoss.totalDrawings,
    totalLiabilitiesEquity,
    isBalanced,
    sections,
  };
}
