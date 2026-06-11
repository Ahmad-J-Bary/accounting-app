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
  TransferTo:     { label: 'تحويل إلى', inflow: true,  group: 'inflow' },
  Damaged:        { label: 'تالف', inflow: false, group: 'outflow' },
  Sale:           { label: 'مبيعات', inflow: false, group: 'outflow' },
  PurchaseReturn: { label: 'مرتجع مشتريات', inflow: false, group: 'outflow' },
  TransferFrom:   { label: 'تحويل من', inflow: false, group: 'outflow' },
  Adjustment:     { label: 'تسوية', inflow: false, group: 'outflow' },
};

export function getMovementType(type: string): MovementTypeInfo {
  const clean = type.replace('MovementType::', '');
  return MOVEMENT_TYPE_CONFIG[clean] || { label: clean, inflow: true, group: 'root' };
}

export const MOVEMENT_TYPE_KEYS = Object.keys(MOVEMENT_TYPE_CONFIG);

export const PARENT_CHILD_MAP: Record<string, string[]> = {
  In: ['OpeningBalance', 'Purchase', 'SalesReturn', 'TransferTo'],
  Out: ['Damaged', 'Sale', 'PurchaseReturn', 'TransferFrom', 'Adjustment'],
};

export const CHILD_PARENT_MAP: Record<string, string> = {};
for (const [parent, children] of Object.entries(PARENT_CHILD_MAP)) {
  for (const child of children) {
    CHILD_PARENT_MAP[child] = parent;
  }
}

interface HasMovementType {
  reference?: string | null;
  movement_type: string;
}

export function getTransferRefs(items: HasMovementType[]): Set<string> {
  const refsIn = new Set<string>();
  const refsOut = new Set<string>();
  for (const m of items) {
    if (!m.reference) continue;
    const clean = m.movement_type.replace('MovementType::', '');
    if (clean === 'In') refsIn.add(m.reference);
    else if (clean === 'Out') refsOut.add(m.reference);
  }
  const result = new Set<string>();
  for (const r of refsIn) { if (refsOut.has(r)) result.add(r); }
  return result;
}
