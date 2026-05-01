import { invoke } from '@/lib/invoke';
import type { 
  MaterialDto, 
  CreateMaterialRequest,
  UpdateMaterialRequest
} from '@erp/shared-types';

export const materialService = {
  async createMaterial(request: CreateMaterialRequest): Promise<MaterialDto> {
    return await invoke<MaterialDto>('create_material', { request });
  },

  async listMaterials(): Promise<MaterialDto[]> {
    return await invoke<MaterialDto[]>('list_materials');
  },

  async getMaterial(id: string): Promise<MaterialDto> {
    return await invoke<MaterialDto>('get_material', { id });
  },

  async updateMaterial(request: UpdateMaterialRequest): Promise<MaterialDto> {
    return await invoke<MaterialDto>('update_material', { request });
  },

  async deleteMaterial(id: string): Promise<void> {
    return await invoke<void>('delete_material', { id });
  },
  
  async addMaterialUnit(request: any): Promise<void> {
    return await invoke<void>('add_material_unit', { request });
  },

  async deleteMaterialUnit(id: string): Promise<void> {
    return await invoke<void>('delete_material_unit', { id });
  },
};
