use std::sync::Arc;
use domain::auth::{User, Role};
use domain::shared::ids::RoleId;
use crate::ports::user_repository::UserRepository;
use crate::dto::user_dto::{CreateUserRequest, CreateRoleRequest, UserDto, RoleDto};
use crate::errors::AppError;

fn user_to_dto(u: User) -> UserDto {
    UserDto {
        id: u.id.to_string(),
        username: u.username,
        full_name: u.full_name,
        role_id: u.role_id.to_string(),
        role_name: None,
        is_active: u.is_active,
        last_login: u.last_login.map(|d| d.to_rfc3339()),
        created_at: u.created_at.to_rfc3339(),
    }
}

fn role_to_dto(r: Role) -> RoleDto {
    RoleDto {
        id: r.id.to_string(),
        name: r.name,
        description: r.description,
        permissions: r.permissions.into_iter().map(|p| format!("{:?}", p)).collect(),
        is_system_role: r.is_system_role,
        created_at: r.created_at.to_rfc3339(),
    }
}

pub struct CreateUserUseCase {
    repo: Arc<dyn UserRepository>,
}

impl CreateUserUseCase {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateUserRequest) -> Result<UserDto, AppError> {
        let role_id: RoleId = req.role_id.parse()
            .map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ø¯ÙˆØ± ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
        // In production, hash password here
        let password_hash = format!("hashed:{}", req.password);
        let user = User::new(req.username, req.full_name, password_hash, role_id)
            .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.save(&user).await?;
        Ok(user_to_dto(user))
    }
}

pub struct ListUsersUseCase {
    repo: Arc<dyn UserRepository>,
}

impl ListUsersUseCase {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<UserDto>, AppError> {
        Ok(self.repo.list_all().await?.into_iter().map(user_to_dto).collect())
    }
}

pub struct ListRolesUseCase {
    repo: Arc<dyn UserRepository>,
}

impl ListRolesUseCase {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<RoleDto>, AppError> {
        Ok(self.repo.list_roles().await?.into_iter().map(role_to_dto).collect())
    }
}

pub struct CreateRoleUseCase {
    repo: Arc<dyn UserRepository>,
}

impl CreateRoleUseCase {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateRoleRequest) -> Result<RoleDto, AppError> {
        let permissions = req.permissions.into_iter()
            .filter_map(|p| match p.as_str() {
                "ViewAccounts" => Some(domain::auth::Permission::ViewAccounts),
                "CreateAccount" => Some(domain::auth::Permission::CreateAccount),
                "ViewCustomers" => Some(domain::auth::Permission::ViewCustomers),
                "CreateCustomer" => Some(domain::auth::Permission::CreateCustomer),
                "ViewSuppliers" => Some(domain::auth::Permission::ViewSuppliers),
                "ViewSalesInvoices" => Some(domain::auth::Permission::ViewSalesInvoices),
                "ViewPurchaseInvoices" => Some(domain::auth::Permission::ViewPurchaseInvoices),
                "ViewPayments" => Some(domain::auth::Permission::ViewPayments),
                "ViewProducts" => Some(domain::auth::Permission::ViewProducts),
                "ViewInventory" => Some(domain::auth::Permission::ViewInventory),
                "ViewReports" => Some(domain::auth::Permission::ViewReports),
                "ViewUsers" => Some(domain::auth::Permission::ViewUsers),
                "ViewSettings" => Some(domain::auth::Permission::ViewSettings),
                "Admin" => Some(domain::auth::Permission::Admin),
                _ => None,
            })
            .collect();
        let role = Role::new(req.name, req.description, permissions)
            .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.save_role(&role).await?;
        Ok(role_to_dto(role))
    }
}
