import { invoke } from '@shared/lib/invoke';
import type { 
  CustomerDto, 
  CreateCustomerRequest, 
  UpdateCustomerRequest 
} from '@erp/shared-types';

export const customerService = {
  async createCustomer(request: CreateCustomerRequest): Promise<CustomerDto> {
    return await invoke<CustomerDto>('create_customer', { request });
  },

  async listCustomers(): Promise<CustomerDto[]> {
    return await invoke<CustomerDto[]>('list_customers');
  },

  async getCustomer(id: string): Promise<CustomerDto> {
    return await invoke<CustomerDto>('get_customer', { id });
  },
  async updateCustomer(request: UpdateCustomerRequest): Promise<CustomerDto> {
    return await invoke<CustomerDto>('update_customer', { request });
  },
  async deleteCustomer(id: string): Promise<void> {
    return await invoke<void>('delete_customer', { id });
  },
};
