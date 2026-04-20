import { invoke } from '@tauri-apps/api/core';
import type { 
  ProductDto, 
  CreateProductRequest 
} from '@erp/shared-types';

export const productService = {
  async createProduct(request: CreateProductRequest): Promise<ProductDto> {
    // TODO: Implement Tauri command
    return {} as ProductDto;
  },

  async listProducts(): Promise<ProductDto[]> {
    // TODO: Implement Tauri command
    return [];
  },

  async getProduct(id: string): Promise<ProductDto> {
    // TODO: Implement Tauri command
    return {} as ProductDto;
  },
};
