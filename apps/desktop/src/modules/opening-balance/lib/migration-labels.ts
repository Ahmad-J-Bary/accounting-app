import type { AccountDto } from "@erp/shared-types";

export interface AccountLine {
  key: string;
  account_id: string;
  amount: string;
  description: string;
}

export const TYPE_LABEL: Record<string, string> = {
  Assets: "أصل",
  Liabilities: "التزام",
  Equity: "حقوق ملكية",
  Revenue: "إيراد",
  Expenses: "مصروف",
};

export const RECON_ROW_LABEL: Record<string, string> = {
  AR: "الذمم المدينة (العملاء)",
  AP: "الذمم الدائنة (الموردون)",
  Inventory: "المخزون",
  FixedAssets: "الأصول الثابتة",
};

export function isDebitNature(accountType: string): boolean {
  return accountType === "Assets" || accountType === "Expenses";
}

export function findAccount(accounts: readonly AccountDto[], id: string): AccountDto | undefined {
  return accounts.find((a) => a.id === id);
}

export function newLineKey(): string {
  return `ob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}