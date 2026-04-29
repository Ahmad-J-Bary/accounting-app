use std::sync::Arc;
use domain::auth::{Role};
use crate::ports::user_repository::UserRepository;
use crate::dto::user_dto::{CreateRoleRequest, RoleDto};
use crate::errors::AppError;

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

pub struct RoleQueries {
    repo: Arc<dyn UserRepository>,
}

impl RoleQueries {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_all(&self) -> Result<Vec<RoleDto>, AppError> {
        Ok(self.repo.list_roles().await?.into_iter().map(role_to_dto).collect())
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
