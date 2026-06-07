import { invoke } from '@shared/lib/invoke';
import type {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '@erp/shared-types';

export interface DeleteCategoryCascadeResult {
  materials_reassigned: number;
  subs_deleted: number;
}

export const categoryService = {
  async createCategory(request: CreateCategoryRequest): Promise<CategoryDto> {
    return await invoke<CategoryDto>('create_category', { request });
  },

  async listCategories(): Promise<CategoryDto[]> {
    return await invoke<CategoryDto[]>('list_categories');
  },

  async updateCategory(request: UpdateCategoryRequest): Promise<CategoryDto> {
    return await invoke<CategoryDto>('update_category', { request });
  },

  async deleteCategory(id: string): Promise<void> {
    return await invoke<void>('delete_category', { id });
  },

  async deleteCategoryWithReassignment(
    id: string,
    reassignMaterialsTo: string
  ): Promise<DeleteCategoryCascadeResult> {
    return await invoke<DeleteCategoryCascadeResult>(
      'delete_category_with_reassignment',
      { id, reassignMaterialsTo }
    );
  },

  async getOrCreateHybridCategory(prefixes: string[]): Promise<CategoryDto> {
    return await invoke<CategoryDto>('get_or_create_hybrid_category', { prefixes });
  },
};
