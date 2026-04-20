import { invoke } from '@tauri-apps/api/core';
import type { 
  CustomerDto, 
  CreateCustomerRequest 
} from '@erp/shared-types';

export const customerService = {
  async createCustomer(request: CreateCustomerRequest): Promise<CustomerDto> {
    // TODO: Implement Tauri command
    return {} as CustomerDto;
  },

  async listCustomers(): Promise<CustomerDto[]> {
    // TODO: Implement Tauri command
    return [];
  },

  async getCustomer(id: string): Promise<CustomerDto> {
    // TODO: Implement Tauri command
    return {} as CustomerDto;
  },
};
