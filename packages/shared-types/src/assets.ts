export interface FixedAssetDto {
  id: string;
  code: string;
  name: string;
  category_id: string;
  purchase_date: string;
  purchase_cost: {
    amount: string;
    currency: string;
  };
  fx_rate: string;
  useful_life_months: number;
  salvage_value?: {
    amount: string;
    currency: string;
  };
  accumulated_depreciation: {
    amount: string;
    currency: string;
  };
  status: 'Active' | 'Disposed' | 'Sold' | 'Damaged';
  location?: string;
  notes?: string;
}

export interface ConsumableDto {
  id: string;
  code: string;
  name: string;
  category_id: string;
  quantity_on_hand: string;
  unit_cost: {
    amount: string;
    currency: string;
  };
  fx_rate: string;
  status: 'InStock' | 'Exhausted' | 'Damaged';
  location?: string;
  notes?: string;
}
