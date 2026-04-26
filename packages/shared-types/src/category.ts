export interface CategoryDto {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  material_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  parent_id?: string | null;
}

export interface UpdateCategoryRequest {
  id: string;
  name: string;
  parent_id?: string | null;
  is_active: boolean;
}
