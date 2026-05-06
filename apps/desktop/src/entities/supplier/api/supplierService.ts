import { invoke } from '@/lib/invoke';
import type {
  SupplierDto,
  CreateSupplierRequest,
  UpdateSupplierRequest,
} from '@erp/shared-types';

export const supplierService = {
  async createSupplier(request: CreateSupplierRequest): Promise<SupplierDto> {
    return await invoke<SupplierDto>('create_supplier', { request }); // Rust command uses 'request' (CreateSupplierRequest)
  },

  async listSuppliers(): Promise<SupplierDto[]> {
    return await invoke<SupplierDto[]>('list_suppliers');
  },

  async getSupplier(id: string): Promise<SupplierDto> {
    return await invoke<SupplierDto>('get_supplier', { id });
  },

  async updateSupplier(request: UpdateSupplierRequest): Promise<SupplierDto> {
    return await invoke<SupplierDto>('update_supplier', { request });
  },

  async deleteSupplier(id: string): Promise<void> {
    return await invoke<void>('delete_supplier', { id });
  },
};
