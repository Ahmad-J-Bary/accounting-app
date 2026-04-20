import { invoke } from '@tauri-apps/api/core';
import type {
  Payment,
  CreatePaymentRequest,
} from '@erp/shared-types';

export const paymentService = {
  async createPayment(request: CreatePaymentRequest): Promise<Payment> {
    return await invoke<Payment>('create_payment', { request });
  },

  async listPayments(customerId?: string, supplierId?: string): Promise<Payment[]> {
    return await invoke<Payment[]>('list_payments', { customerId, supplierId });
  },
};
