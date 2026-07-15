import { invoke } from '@shared/lib/invoke';
import type { CreateTransferRequest, UpdateTransferRequest, TransferResponse } from '@erp/shared-types';

export const transferService = {
  async create(request: CreateTransferRequest): Promise<TransferResponse> {
    return await invoke<TransferResponse>('create_transfer', { request });
  },

  async update(request: UpdateTransferRequest): Promise<TransferResponse> {
    return await invoke<TransferResponse>('update_transfer', { request });
  },

  async delete(reference: string): Promise<void> {
    return await invoke<void>('delete_transfer', { reference });
  },
};
