import { invoke } from '@tauri-apps/api/core';
import type {
  SalesReturnDto,
  PurchaseReturnDto,
  CreateSalesReturnRequest,
  CreatePurchaseReturnRequest,
} from '@erp/shared-types';

export const returnService = {
  async createSalesReturn(req: CreateSalesReturnRequest): Promise<SalesReturnDto> {
    return invoke('create_sales_return', { request: req });
  },

  async listSalesReturns(): Promise<SalesReturnDto[]> {
    return invoke('list_sales_returns');
  },

  async getSalesReturn(id: string): Promise<SalesReturnDto> {
    return invoke('get_sales_return', { id });
  },

  async postSalesReturn(id: string): Promise<SalesReturnDto> {
    return invoke('post_sales_return', { id });
  },

  async createPurchaseReturn(req: CreatePurchaseReturnRequest): Promise<PurchaseReturnDto> {
    return invoke('create_purchase_return', { request: req });
  },

  async listPurchaseReturns(): Promise<PurchaseReturnDto[]> {
    return invoke('list_purchase_returns');
  },

  async getPurchaseReturn(id: string): Promise<PurchaseReturnDto> {
    return invoke('get_purchase_return', { id });
  },

  async postPurchaseReturn(id: string): Promise<PurchaseReturnDto> {
    return invoke('post_purchase_return', { id });
  },
};
