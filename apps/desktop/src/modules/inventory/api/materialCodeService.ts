import { invoke } from "@shared/lib/invoke";

export const materialCodeService = {
  async generateCode(categoryId: string): Promise<string> {
    return await invoke("generate_material_code", { categoryId });
  },
};
