import { invoke } from '@shared/lib/invoke';
import { createCrudService } from '@shared/lib/createService';
import type { WarehouseDto, CreateWarehouseRequest, UpdateWarehouseRequest, CompanySettings } from '@erp/shared-types';
import { settingsService } from '@modules/core/api/settingsService';

const crud = createCrudService<WarehouseDto, CreateWarehouseRequest, UpdateWarehouseRequest>({
  name: 'warehouse',
});

export const warehouseService = {
  ...crud,

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
        return await this.update({
          id: existingDefault.id,
          name: warehouseName,
          address: existingDefault.address,
          is_active: existingDefault.is_active,
          is_default: true,
        });
      }
      return existingDefault;
    }

    const warehouses = await this.list();
    const existingByName = warehouses.find(w => w.name === warehouseName);
    if (existingByName) return existingByName;

    return await this.create({ name: warehouseName });
  },
};
