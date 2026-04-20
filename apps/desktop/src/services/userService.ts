import { invoke } from '@tauri-apps/api/core';
import type {
  User,
  Role,
  CreateUserRequest,
  CreateRoleRequest,
} from '@erp/shared-types';

export const userService = {
  async createUser(request: CreateUserRequest): Promise<User> {
    return await invoke<User>('create_user', { request });
  },

  async listUsers(): Promise<User[]> {
    return await invoke<User[]>('list_users');
  },

  async listRoles(): Promise<Role[]> {
    return await invoke<Role[]>('list_roles');
  },

  async createRole(request: CreateRoleRequest): Promise<Role> {
    return await invoke<Role>('create_role', { request });
  },
};
