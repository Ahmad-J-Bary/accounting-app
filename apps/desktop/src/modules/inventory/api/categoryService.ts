import { invoke } from '@shared/lib/invoke';
import { createCrudService } from '@shared/lib/createService';
import type {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '@erp/shared-types';

export interface DeleteCategoryCascadeResult {
  materials_reassigned: number;
  subs_deleted: number;
}

const crud = createCrudService<CategoryDto, CreateCategoryRequest, UpdateCategoryRequest>({
  name: 'category',
  pluralName: 'categories',
});

export const categoryService = {
  ...crud,

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

  // Backward compatibility aliases for raw CRUD methods
  createCategory(request: CreateCategoryRequest): Promise<CategoryDto> {
    return this.create(request);
  },

  listCategories(): Promise<CategoryDto[]> {
    return this.list();
  },

  updateCategory(request: UpdateCategoryRequest): Promise<CategoryDto> {
    return this.update(request);
  },

  deleteCategory(id: string): Promise<void> {
    return this.delete(id);
  },
};
