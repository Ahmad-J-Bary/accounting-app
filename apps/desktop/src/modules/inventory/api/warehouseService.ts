import { invoke } from '@shared/lib/invoke';
import type { WarehouseDto, CreateWarehouseRequest, UpdateWarehouseRequest, CompanySettings } from '@erp/shared-types';
import { settingsService } from '@modules/core/api/settingsService';

export const warehouseService = {
  async createWarehouse(request: CreateWarehouseRequest): Promise<WarehouseDto> {
    return await invoke<WarehouseDto>('create_warehouse', { request });
  },

  async listWarehouses(): Promise<WarehouseDto[]> {
    return await invoke<WarehouseDto[]>('list_warehouses');
  },

  async getWarehouse(id: string): Promise<WarehouseDto | null> {
    return await invoke<WarehouseDto | null>('get_warehouse', { id });
  },

  async updateWarehouse(request: UpdateWarehouseRequest): Promise<WarehouseDto> {
    return await invoke<WarehouseDto>('update_warehouse', { request });
  },

  async deleteWarehouse(id: string): Promise<void> {
    return await invoke<void>('delete_warehouse', { id });
  },

  async getDefaultWarehouse(): Promise<WarehouseDto | null> {
    return await invoke<WarehouseDto | null>('get_default_warehouse');
  },

  async ensureDefaultWarehouse(): Promise<WarehouseDto> {
    const settings: CompanySettings = await settingsService.getSettings();
    const companyName = settings.company_name || 'الشركة';
    const warehouseName = `مستودع ${companyName}`;

    const existingDefault = await this.getDefaultWarehouse();
    if (existingDefault) {
      if (existingDefault.name !== warehouseName) {
        return await this.updateWarehouse({
          id: existingDefault.id,
          name: warehouseName,
          address: existingDefault.address,
          is_active: existingDefault.is_active,
          is_default: true,
        });
      }
      return existingDefault;
    }

    const warehouses = await this.listWarehouses();
    const existingByName = warehouses.find(w => w.name === warehouseName);
    if (existingByName) return existingByName;

    return await this.createWarehouse({ name: warehouseName });
  },
};
