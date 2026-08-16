import type { AccountDto } from "@erp/shared-types";
import { SYSTEM_ACCOUNT_IDS } from "@erp/shared-types";

export type AutoAccountKind = "cash" | "bank" | "loan" | "inventory";

/**
 * Pick a sensible default account for an "amount-only" opening section so the
 * user never thinks in debit/credit. The account is always overridable with the
 * combobox; returning "" means "no default found — pick one manually".
 */
export function defaultAccountFor(accounts: readonly AccountDto[], kind: AutoAccountKind): string {
  const list = accounts as readonly AccountDto[];
  switch (kind) {
    case "cash": {
      const sys = list.find((a) => a.id === SYSTEM_ACCOUNT_IDS.CASH);
      if (sys) return sys.id;
      const byCode = list.find((a) => a.code.startsWith("1202"));
      if (byCode) return byCode.id;
      return (
        list.find(
          (a) =>
            a.account_type === "Assets" &&
            a.category === "Detail" &&
            /نقد|صندوق|خزينة/.test(a.name_ar),
        )?.id || ""
      );
    }
    case "bank": {
      const byPurpose = list.find((a) => a.purpose === "bank");
      if (byPurpose) return byPurpose.id;
      return (
        list.find(
          (a) => a.account_type === "Assets" && a.category === "Detail" && /بنك/i.test(a.name_ar),
        )?.id || ""
      );
    }
    case "loan": {
      const byPurpose = list.find((a) => a.purpose === "loan");
      if (byPurpose) return byPurpose.id;
      return (
        list.find(
          (a) =>
            a.account_type === "Liabilities" &&
            a.category === "Detail" &&
            /قرض|اقتراض|سلفة/.test(a.name_ar),
        )?.id || ""
      );
    }
    case "inventory": {
      const byPurpose = list.find((a) => a.purpose === "inventory");
      if (byPurpose) return byPurpose.id;
      const byCode1204 = list.find((a) => a.code.startsWith("1204"));
      const byCode1201 = list.find((a) => a.code === "1201");
      return (byCode1204 || byCode1201)?.id || "";
    }
  }
}