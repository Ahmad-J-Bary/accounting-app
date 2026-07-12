import { invoke } from '@shared/lib/invoke';
import type {
  SalesReturnDto,
  PurchaseReturnDto,
  CreateSalesReturnRequest,
  CreatePurchaseReturnRequest,
} from '@erp/shared-types';

export const returnService = {
  async createSalesReturn(req: CreateSalesReturnRequest): Promise<SalesReturnDto> {
    return invoke('create_sales_return', {
      request: {
        ...req,
        settlement_mode: req.settlement_mode ?? null,
        settlement_amount: req.settlement_amount ?? null,
      },
    });
  },

  async updateSalesReturn(req: CreateSalesReturnRequest): Promise<SalesReturnDto> {
    return invoke('update_sales_return', {
      request: {
        ...req,
        settlement_mode: req.settlement_mode ?? null,
        settlement_amount: req.settlement_amount ?? null,
      },
    });
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
    return invoke('create_purchase_return', {
      request: {
        ...req,
        settlement_mode: req.settlement_mode ?? null,
        settlement_amount: req.settlement_amount ?? null,
      },
    });
  },

  async updatePurchaseReturn(req: CreatePurchaseReturnRequest): Promise<PurchaseReturnDto> {
    return invoke('update_purchase_return', {
      request: {
        ...req,
        settlement_mode: req.settlement_mode ?? null,
        settlement_amount: req.settlement_amount ?? null,
      },
    });
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

  async deleteSalesReturn(id: string): Promise<void> {
    return invoke('delete_sales_return', { id });
  },

  async deletePurchaseReturn(id: string): Promise<void> {
    return invoke('delete_purchase_return', { id });
  },

  async getNextSalesReturnNumber(): Promise<string> {
    return invoke('get_next_sales_return_number');
  },

  async getNextPurchaseReturnNumber(): Promise<string> {
    return invoke('get_next_purchase_return_number');
  },
};
