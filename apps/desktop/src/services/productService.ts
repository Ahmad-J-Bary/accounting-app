import { invoke } from '@/lib/invoke';
import type { 
  ProductDto, 
  CreateProductRequest 
} from '@erp/shared-types';

export const productService = {
  async createProduct(request: CreateProductRequest): Promise<ProductDto> {
    return await invoke<ProductDto>('create_product', { request });
  },

  async listProducts(): Promise<ProductDto[]> {
    return await invoke<ProductDto[]>('list_products');
  },

  async getProduct(id: string): Promise<ProductDto> {
    return await invoke<ProductDto>('get_product', { id });
  },
};
