import { invoke } from '@shared/lib/invoke';
import type { 
  MaterialDto, 
  CreateMaterialRequest,
  UpdateMaterialRequest,
  CreateMaterialPriceRequest,
  CreateMaterialSalePriceRequest,
  StockMovementDetailDto,
} from '@erp/shared-types';

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

export const materialService = {
  async createMaterial(request: CreateMaterialRequest): Promise<MaterialDto> {
    return await invoke<MaterialDto>('create_material', { request: normalizeCreateRequest(request) });
  },

  async listMaterials(): Promise<MaterialDto[]> {
    return await invoke<MaterialDto[]>('list_materials');
  },

  async getMaterial(id: string): Promise<MaterialDto> {
    return await invoke<MaterialDto>('get_material', { id });
  },

  async updateMaterial(request: UpdateMaterialRequest): Promise<MaterialDto> {
    return await invoke<MaterialDto>('update_material', { request: normalizeUpdateRequest(request) });
  },

  async deleteMaterial(id: string): Promise<void> {
    return await invoke<void>('delete_material', { id });
  },
  
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
