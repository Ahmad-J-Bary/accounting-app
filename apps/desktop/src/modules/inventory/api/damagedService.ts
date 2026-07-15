import { createCrudService } from '@shared/lib/createService';
import type { DamagedItem, CreateDamagedItemRequest, UpdateDamagedItemRequest } from '@erp/shared-types';

export const damagedService = createCrudService<DamagedItem, CreateDamagedItemRequest, UpdateDamagedItemRequest>({
  name: 'damaged_item',
  pluralName: 'damaged_items',
});
