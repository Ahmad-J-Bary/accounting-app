import { invoke } from '@tauri-apps/api/core';
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

  async postPurchaseInvoice(invoiceId: string): Promise<PurchaseInvoice> {
    return await invoke<PurchaseInvoice>('post_purchase_invoice', { invoiceId });
  },
};
