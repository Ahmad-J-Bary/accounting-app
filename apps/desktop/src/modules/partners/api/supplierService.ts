import { createCrudService } from '@shared/lib/createService';
import type {
  SupplierDto,
  CreateSupplierRequest,
  UpdateSupplierRequest,
} from '@erp/shared-types';

export const supplierService = createCrudService<SupplierDto, CreateSupplierRequest, UpdateSupplierRequest>({
  name: 'supplier',
});
