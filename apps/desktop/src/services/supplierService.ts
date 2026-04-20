import { invoke } from '@tauri-apps/api/core';
import type {
  Supplier,
  CreateSupplierRequest,
} from '@erp/shared-types';

export const supplierService = {
  async createSupplier(request: CreateSupplierRequest): Promise<Supplier> {
    return await invoke<Supplier>('create_supplier', { request });
  },

  async listSuppliers(): Promise<Supplier[]> {
    return await invoke<Supplier[]>('list_suppliers');
  },

  async getSupplier(id: string): Promise<Supplier> {
    return await invoke<Supplier>('get_supplier', { id });
  },

  async deleteSupplier(id: string): Promise<void> {
    return await invoke<void>('delete_supplier', { id });
  },
};
