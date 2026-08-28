/**
 * Resolve the effective profit-sharing ratio for a partner.
 *
 * Business rule (spec Sec 23): Manual wins; otherwise the ratio is
 * capital-based — either on LOCAL (base) capital or on the partner's
 * ORIGINAL (own-currency) capital.
 *
 * @param localRatio    - Partner's capital ratio in base currency.
 * @param originalRatio - Partner's capital ratio in own currency.
 * @param partner       - The partner record.
 * @returns The resolved profit-sharing ratio as a percentage.
 */
export function resolveProfitShareRatio(
  localRatio: number,
  originalRatio: number,
  partner: { profit_sharing_type?: string; profit_sharing_ratio?: string | null }
): number {
  if (partner.profit_sharing_type === "Manual") {
    return partner.profit_sharing_ratio ? parseFloat(partner.profit_sharing_ratio) : 0;
  }
  if (partner.profit_sharing_type === "BasedOnCapitalOriginal") {
    return originalRatio;
  }
  return localRatio;
}
