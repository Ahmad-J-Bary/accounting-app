import { createCrudService } from '@shared/lib/createService';
import type {
  MaterialDto,
  CreateMaterialRequest,
  UpdateMaterialRequest,
  CreateMaterialPriceRequest,
  CreateMaterialSalePriceRequest,
  StockMovementDetailDto,
} from '@erp/shared-types';
import { invoke } from '@shared/lib/invoke';

export interface AddMaterialUnitRequest {
  material_id: string;
  name: string;
  conversion_factor: string;
  barcode: string | null;
}

const normalizeText = (value?: string | null) => (value ?? '').trim();

function dedupePurchasePrices(
  prices: Array<Partial<CreateMaterialPriceRequest>> = [],
): CreateMaterialPriceRequest[] {
  const unique = new Map<string, CreateMaterialPriceRequest>();

  for (const price of prices) {
    const unit_id = normalizeText(price.unit_id);
    const currency = normalizeText(price.currency);
    if (!unit_id) continue;

    unique.set(`${unit_id}::${currency}`, {
      unit_id,
      price: String(price.price ?? '0'),
      price_base: String(price.price_base ?? '0'),
      currency,
    });
  }

  return Array.from(unique.values());
}

function dedupeSalePrices(
  prices: Array<Partial<CreateMaterialSalePriceRequest>> = [],
): CreateMaterialSalePriceRequest[] {
  const unique = new Map<string, CreateMaterialSalePriceRequest>();

  for (const price of prices) {
    const unit_id = normalizeText(price.unit_id);
    const tier = normalizeText(price.tier);
    const currency = normalizeText(price.currency);
    if (!unit_id || !tier) continue;

    unique.set(`${unit_id}::${tier}::${currency}`, {
      unit_id,
      tier,
      price: String(price.price ?? '0'),
      price_base: String(price.price_base ?? '0'),
      min_price: String(price.min_price ?? '0'),
      min_price_base: String(price.min_price_base ?? '0'),
      max_quantity: String(price.max_quantity ?? '0'),
      max_quantity_unit_id: price.max_quantity_unit_id ?? null,
      currency,
    });
  }

  return Array.from(unique.values());
}

function normalizeCreateRequest(request: CreateMaterialRequest): CreateMaterialRequest {
  return {
    ...request,
    default_purchase_unit_id: normalizeText(request.default_purchase_unit_id) || undefined,
    default_sale_unit_id: normalizeText(request.default_sale_unit_id) || undefined,
    purchase_prices: dedupePurchasePrices(request.purchase_prices),
    sale_prices: dedupeSalePrices(request.sale_prices),
  };
}

function normalizeUpdateRequest(request: UpdateMaterialRequest): UpdateMaterialRequest {
  return {
    ...request,
    default_purchase_unit_id: normalizeText(request.default_purchase_unit_id) || null,
    default_sale_unit_id: normalizeText(request.default_sale_unit_id) || null,
    purchase_prices: dedupePurchasePrices(request.purchase_prices),
    sale_prices: dedupeSalePrices(request.sale_prices),
  };
}

const base = createCrudService<MaterialDto, CreateMaterialRequest, UpdateMaterialRequest>({
  name: 'material',
  createTransform: normalizeCreateRequest,
  updateTransform: normalizeUpdateRequest,
});

export const materialService = {
  ...base,

  async addMaterialUnit(request: AddMaterialUnitRequest): Promise<void> {
    return await invoke<void>('add_material_unit', { request });
  },

  async deleteMaterialUnit(id: string): Promise<void> {
    return await invoke<void>('delete_material_unit', { id });
  },

  async listMovementsByMaterial(materialId: string): Promise<StockMovementDetailDto[]> {
    return await invoke<StockMovementDetailDto[]>('list_movements_by_material', { materialId });
  },
};
