import type { AccountDto } from "@erp/shared-types";

export type AccountTypeUiMeta = {
  label: string;
  color: string;
};

export type AccountTypeLabels = Record<string, AccountTypeUiMeta>;

export interface AccountTreeNode extends AccountDto {
  children: AccountTreeNode[];
}

export type ToggleNodeHandler = (id: string, event: React.MouseEvent) => void;

export const TYPE_LABELS: AccountTypeLabels = {
  Assets: { label: "أصول", color: "bg-blue-50 text-blue-700 border-blue-200" },
  Liabilities: {
    label: "خصوم",
    color: "bg-red-50 text-red-700 border-red-200",
  },
  Equity: {
    label: "حقوق ملكية",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  Revenue: {
    label: "إيرادات",
    color: "bg-green-50 text-green-700 border-green-200",
  },
  Expenses: {
    label: "مصروفات",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
};
