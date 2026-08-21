/**
 * Centralized payment direction classification.
 *
 * "Incoming" payments increase cash/asset (receipts).
 * "Outgoing" payments decrease cash/asset (disbursements).
 */

export const INCOMING_PAYMENT_TYPES = ["Receipt", "CashIn", "SupplierReceipt"] as const;

export const OUTGOING_PAYMENT_TYPES = [
  "SupplierPayment",
  "CustomerPayment",
  "CashOut",
  "ExpenseVoucher",
  "DrawingsVoucher",
] as const;

export type IncomingPaymentType = (typeof INCOMING_PAYMENT_TYPES)[number];
export type OutgoingPaymentType = (typeof OUTGOING_PAYMENT_TYPES)[number];

/** True if the payment type represents an incoming payment (receipt). */
export function isIncomingPayment(type: string): boolean {
  return (INCOMING_PAYMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Base-currency amount with sign based on payment direction.
 * Incoming = positive, outgoing = negative.
 */
export function signedBaseAmount(amount: number, paymentType: string): number {
  return isIncomingPayment(paymentType) ? amount : -amount;
}
