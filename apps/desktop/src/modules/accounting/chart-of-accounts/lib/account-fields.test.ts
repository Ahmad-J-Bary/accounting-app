import { describe, expect, it } from "vitest";
import { mergeAccountEntityFields, type AccountField } from "./account-fields";

const accountFields: AccountField[] = [
  { key: "account-code", label: "رقم الحساب", value: "1201" },
  { key: "account-name", label: "اسم الحساب", value: "عميل" },
  { key: "account-currency", label: "العملة", value: "USD" },
  { key: "account-balance", label: "الرصيد", value: "100" },
];

const customerFields: AccountField[] = [
  { key: "entity-phone", label: "رقم الهاتف", value: "09x" },
  { key: "entity-balance", label: "الرصيد الحالي", value: "100" },
];

const partnerCapitalFields: AccountField[] = [
  { key: "partner-role", label: "دور الحساب", value: "حساب رأس المال" },
  { key: "partner-amount-original", label: "المبلغ المشارك به", value: "5000 USD" },
  { key: "partner-amount-local", label: "المبلغ", value: "5000.00" },
  { key: "partner-ratio", label: "نسبة الأرباح المخصصة (%)", value: "40.00%" },
  { key: "partner-distribution", label: "طريقة التوزيع", value: "يدوي" },
];

const partnerOperationalFields: AccountField[] = [
  { key: "partner-name", label: "الشريك", value: "أحمد" },
  { key: "partner-role", label: "دور الحساب", value: "حساب المسحوبات" },
];

describe("mergeAccountEntityFields", () => {
  it("returns the account grid unchanged when no entity is linked", () => {
    const merged = mergeAccountEntityFields(accountFields, [], null, null, true);
    expect(merged).toHaveLength(accountFields.length);
    expect(merged.map((f) => f.key)).toEqual([
      "account-code",
      "account-name",
      "account-currency",
      "account-balance",
    ]);
  });

  it("drops the account-side العملة / الرصيد for a customer and merges its fields", () => {
    const merged = mergeAccountEntityFields(accountFields, customerFields, "customer");
    expect(merged.map((f) => f.key)).toEqual([
      "account-code",
      "account-name",
      "entity-phone",
      "entity-balance",
    ]);
    expect(merged.find((f) => f.key === "account-currency")).toBeUndefined();
    expect(merged.find((f) => f.key === "account-balance")).toBeUndefined();
    expect(merged.map((f) => f.label).filter((l) => l === "العملة")).toHaveLength(0);
  });

  it("drops the account-side العملة / الرصيد for a supplier too", () => {
    const merged = mergeAccountEntityFields(accountFields, customerFields, "supplier");
    expect(merged.find((f) => f.key === "account-currency")).toBeUndefined();
    expect(merged.find((f) => f.key === "account-balance")).toBeUndefined();
  });

  it("replaces the account-side العملة / الرصيد with the partner capital fields", () => {
    const merged = mergeAccountEntityFields(accountFields, partnerCapitalFields, "partner");
    expect(merged.map((f) => f.key)).toEqual([
      "account-code",
      "account-name",
      "partner-role",
      "partner-amount-original",
      "partner-amount-local",
      "partner-ratio",
      "partner-distribution",
    ]);
    expect(merged.find((f) => f.key === "account-currency")).toBeUndefined();
    expect(merged.find((f) => f.key === "account-balance")).toBeUndefined();
  });

  it("keeps the account-side العملة / الرصيد for partner drawings / current accounts", () => {
    const merged = mergeAccountEntityFields(
      accountFields,
      partnerOperationalFields,
      "partner",
      "drawings",
      true,
    );
    expect(merged.map((f) => f.key)).toEqual([
      "account-code",
      "account-name",
      "account-currency",
      "account-balance",
      "partner-name",
      "partner-role",
    ]);
  });

  it("treats a missing partner role as capital", () => {
    const merged = mergeAccountEntityFields(accountFields, partnerCapitalFields, "partner");
    expect(merged.find((f) => f.key === "account-currency")).toBeUndefined();
  });
});