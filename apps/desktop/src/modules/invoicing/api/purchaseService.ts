import { invoke } from '@shared/lib/invoke';
import type {
  PurchaseInvoice,
  CreatePurchaseInvoiceRequest,
} from '@erp/shared-types';

export const purchaseService = {
  async createPurchaseInvoice(request: CreatePurchaseInvoiceRequest): Promise<PurchaseInvoice> {
    return await invoke<PurchaseInvoice>('create_purchase_invoice', { request });
  },

  async listPurchaseInvoices(supplierId?: string): Promise<PurchaseInvoice[]> {
    return await invoke<PurchaseInvoice[]>('list_purchase_invoices', { supplierId });
  },

  async postPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
    return await invoke<PurchaseInvoice>('post_purchase_invoice', { id });
  },
};
