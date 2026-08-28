export type PartnerStatementRow = {
  partnerId: string;
  partnerName: string;
  capitalAmount: number;
  accumulatedProfits: number;
  accumulatedDrawings: number;
  currentAccount: number;
  thisYearProfit: number;
  thisYearDrawings: number;
  finalAmount: number;
};

export type PartnerStatementComputed = {
  rows: PartnerStatementRow[];
};
