import { invoke } from '@/lib/invoke';
import type { 
  CustomerDto, 
  CreateCustomerRequest 
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
};
