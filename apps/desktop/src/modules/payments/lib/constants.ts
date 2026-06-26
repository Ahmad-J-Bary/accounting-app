export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  Receipt: "قبض من عميل",
  SupplierPayment: "دفع لمورد",
  CustomerPayment: "سند دفع لعميل",
  SupplierReceipt: "سند قبض من مورد",
  ExpenseVoucher: "سند مصاريف",
  DrawingsVoucher: "سند مسحوبات",
};

// Types that should NOT appear in manual payment creation dropdown
export const HIDDEN_PAYMENT_TYPES = ["CustomerPayment", "SupplierReceipt"];
