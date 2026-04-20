export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  is_system_role: boolean;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  role_id: string;
  role_name?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface CreateUserRequest {
  username: string;
  full_name: string;
  password: string;
  role_id: string;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions: string[];
}
