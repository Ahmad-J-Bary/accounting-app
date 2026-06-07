export interface CategoryDto {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  is_hybrid: boolean;
  code_prefix: string | null;
  material_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  parent_id?: string | null;
  is_hybrid?: boolean;
  code_prefix?: string | null;
}

export interface UpdateCategoryRequest {
  id: string;
  name: string;
  parent_id?: string | null;
  is_active: boolean;
  code_prefix?: string | null;
}

export interface DeleteCategoryCascadeResultDto {
  materials_reassigned: number;
  subs_deleted: number;
}
