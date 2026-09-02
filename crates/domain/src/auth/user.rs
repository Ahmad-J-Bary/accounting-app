use crate::shared::errors::DomainError;
use crate::shared::ids::{RoleId, UserId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: UserId,
    pub username: String,
    pub full_name: String,
    pub password_hash: String,
    pub role_id: RoleId,
    pub is_active: bool,
    pub last_login: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub fn new(
        username: String,
        full_name: String,
        password_hash: String,
        role_id: RoleId,
    ) -> Result<Self, DomainError> {
        if username.trim().is_empty() {
            return Err(DomainError::Invalid(
                "اسم المستخدم لا يمكن أن يكون فارغًا".into(),
            ));
        }
        if full_name.trim().is_empty() {
            return Err(DomainError::Invalid(
                "الاسم الكامل لا يمكن أن يكون فارغًا".into(),
            ));
        }
        if password_hash.trim().is_empty() {
            return Err(DomainError::Invalid(
                "كلمة المرور لا يمكن أن تكون فارغة".into(),
            ));
        }
        let now = Utc::now();
        Ok(Self {
            id: UserId(Uuid::new_v4()),
            username,
            full_name,
            password_hash,
            role_id,
            is_active: true,
            last_login: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn record_login(&mut self) {
        self.last_login = Some(Utc::now());
        self.updated_at = Utc::now();
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }

    pub fn change_role(&mut self, role_id: RoleId) {
        self.role_id = role_id;
        self.updated_at = Utc::now();
    }
}
