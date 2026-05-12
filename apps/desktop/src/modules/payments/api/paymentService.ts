import { invoke } from '@shared/lib/invoke';
import type {
  Payment,
  CreatePaymentRequest,
  UpdatePaymentRequest,
} from '@erp/shared-types';

export const paymentService = {
  async createPayment(request: CreatePaymentRequest): Promise<Payment> {
    return await invoke<Payment>('create_payment', { request });
  },

  async updatePayment(request: UpdatePaymentRequest): Promise<Payment> {
    return await invoke<Payment>('update_payment', { request });
  },

  async listPayments(customerId?: string, supplierId?: string): Promise<Payment[]> {
    return await invoke<Payment[]>('list_payments', { customerId, supplierId });
  },

  async deletePayment(id: string): Promise<void> {
    return await invoke<void>('delete_payment', { id });
  },
};
