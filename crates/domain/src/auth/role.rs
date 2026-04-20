use crate::shared::errors::DomainError;
use crate::shared::ids::RoleId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Permission {
    // Accounting
    ViewAccounts,
    CreateAccount,
    EditAccount,
    DeleteAccount,
    // Journal
    ViewJournal,
    CreateJournalEntry,
    PostJournalEntry,
    // Customers
    ViewCustomers,
    CreateCustomer,
    EditCustomer,
    DeleteCustomer,
    // Suppliers
    ViewSuppliers,
    CreateSupplier,
    EditSupplier,
    DeleteSupplier,
    // Sales
    ViewSalesInvoices,
    CreateSalesInvoice,
    PostSalesInvoice,
    // Purchases
    ViewPurchaseInvoices,
    CreatePurchaseInvoice,
    PostPurchaseInvoice,
    // Payments
    ViewPayments,
    CreatePayment,
    // Products
    ViewProducts,
    CreateProduct,
    EditProduct,
    DeleteProduct,
    // Inventory
    ViewInventory,
    RecordStockMovement,
    // Damaged
    ViewDamagedItems,
    CreateDamagedItem,
    // Production
    ViewProduction,
    CreateProductionOrder,
    // Adjustments
    ViewAdjustments,
    CreateAdjustment,
    // Reports
    ViewReports,
    // Users
    ViewUsers,
    CreateUser,
    EditUser,
    DeleteUser,
    ManageRoles,
    // Settings
    ViewSettings,
    EditSettings,
    // Audit
    ViewAuditLog,
    // Admin
    Admin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: RoleId,
    pub name: String,
    pub description: Option<String>,
    pub permissions: Vec<Permission>,
    pub is_system_role: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Role {
    pub fn new(
        name: String,
        description: Option<String>,
        permissions: Vec<Permission>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم الدور لا يمكن أن يكون فارغًا".into()));
        }
        let now = Utc::now();
        Ok(Self {
            id: RoleId(Uuid::new_v4()),
            name,
            description,
            permissions,
            is_system_role: false,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn admin_role() -> Self {
        let now = Utc::now();
        Self {
            id: RoleId(Uuid::new_v4()),
            name: "مدير النظام".into(),
            description: Some("صلاحيات كاملة".into()),
            permissions: vec![Permission::Admin],
            is_system_role: true,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn has_permission(&self, permission: &Permission) -> bool {
        self.permissions.contains(&Permission::Admin)
            || self.permissions.contains(permission)
    }

    pub fn add_permission(&mut self, permission: Permission) {
        if !self.permissions.contains(&permission) {
            self.permissions.push(permission);
            self.updated_at = Utc::now();
        }
    }

    pub fn remove_permission(&mut self, permission: &Permission) {
        self.permissions.retain(|p| p != permission);
        self.updated_at = Utc::now();
    }
}
