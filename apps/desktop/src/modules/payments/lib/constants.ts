export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  Receipt: "قبض من عميل",
  SupplierPayment: "دفع لمورد",
  CustomerPayment: "سند دفع لعميل",
  SupplierReceipt: "سند قبض من مورد",
  ExpenseVoucher: "سند مصاريف",
  DrawingsVoucher: "سند مسحوبات",
};

// Types hidden from creation dropdown only (visible when editing)
export const HIDDEN_PAYMENT_TYPES = ["CustomerPayment", "SupplierReceipt"];
