export interface MovementTypeInfo {
  label: string;
  inflow: boolean;
  group: 'root' | 'inflow' | 'outflow';
}

export const MOVEMENT_TYPE_CONFIG: Record<string, MovementTypeInfo> = {
  In:             { label: 'الداخل', inflow: true,  group: 'root' },
  Out:            { label: 'الخارج', inflow: false, group: 'root' },
  OpeningBalance: { label: 'أول المدة', inflow: true,  group: 'inflow' },
  Purchase:       { label: 'مشتريات', inflow: true,  group: 'inflow' },
  SalesReturn:    { label: 'مرتجع مبيعات', inflow: true,  group: 'inflow' },
  Transfer:       { label: 'تحويل', inflow: true,  group: 'inflow' },
  Damaged:        { label: 'تالف', inflow: false, group: 'outflow' },
  Sale:           { label: 'مبيعات', inflow: false, group: 'outflow' },
  PurchaseReturn: { label: 'مرتجع مشتريات', inflow: false, group: 'outflow' },
  Adjustment:     { label: 'تسوية', inflow: false, group: 'outflow' },
};

export function getMovementType(type: string): MovementTypeInfo {
  const clean = type.replace('MovementType::', '');
  return MOVEMENT_TYPE_CONFIG[clean] || { label: clean, inflow: true, group: 'root' };
}

export const MOVEMENT_TYPE_KEYS = Object.keys(MOVEMENT_TYPE_CONFIG);

export const PARENT_CHILD_MAP: Record<string, string[]> = {
  In: ['OpeningBalance', 'Purchase', 'SalesReturn', 'Transfer'],
  Out: ['Damaged', 'Sale', 'PurchaseReturn', 'Adjustment'],
};

export const CHILD_PARENT_MAP: Record<string, string> = {};
for (const [parent, children] of Object.entries(PARENT_CHILD_MAP)) {
  for (const child of children) {
    CHILD_PARENT_MAP[child] = parent;
  }
}
