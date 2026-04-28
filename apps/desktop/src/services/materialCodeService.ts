import { invoke } from "@tauri-apps/api/core";

export const materialCodeService = {
  async generateCode(categoryId: string): Promise<string> {
    return await invoke("generate_material_code", { categoryId });
  },
};
