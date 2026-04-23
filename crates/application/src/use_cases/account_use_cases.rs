use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use chrono::Utc;
use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::accounting::journal_entry::JournalEntryStatus;
use domain::shared::AccountId;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::sync::Arc;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AccountUseCaseError {
    #[error("Account repository error: {0}")]
    RepositoryError(String),

    #[error("Journal repository error: {0}")]
    JournalRepositoryError(String),

    #[error("Account not found")]
    AccountNotFound,

    #[error("Parent account not found")]
    ParentNotFound,

    #[error("Code {0} already exists")]
    CodeExists(String),

    #[error("Invalid decimal value: {0}")]
    InvalidDecimal(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Forbidden operation: {0}")]
    Forbidden(String),
}

#[derive(Debug, Deserialize, Clone)]
pub struct CreateAccountCommand {
    pub code: String,
    pub name_ar: String,
    pub name_en: String,
    pub account_type: AccountType,
    pub parent_id: Option<AccountId>,
    pub category: AccountCategory,
    pub level: i32,
    pub opening_balance: String,
    pub notes: Option<String>,
}

pub struct AccountUseCases {
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl AccountUseCases {
    pub fn new(
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            account_repo,
            journal_repo,
        }
    }

    pub async fn create_account(
        &self,
        cmd: CreateAccountCommand,
    ) -> Result<Account, AccountUseCaseError> {
        let opening_balance = Decimal::from_str(&cmd.opening_balance)
            .map_err(|e| AccountUseCaseError::InvalidDecimal(e.to_string()))?;

        self.validate_names_and_code(&cmd)?;
        self.ensure_code_not_exists(&cmd.code, None).await?;
        self.validate_parent_and_level(&cmd).await?;
        self.validate_category_rules(&cmd).await?;
        self.validate_type_hierarchy(&cmd).await?;
        self.protect_root_policy_on_create(&cmd)?;

        let account = Account {
            id: AccountId::new(),
            code: cmd.code.trim().to_string(),
            name_ar: cmd.name_ar.trim().to_string(),
            name_en: cmd.name_en.trim().to_string(),
            account_type: cmd.account_type,
            parent_id: cmd.parent_id,
            category: cmd.category,
            level: cmd.level,
            opening_balance,
            balance: opening_balance,
            notes: cmd.notes.map(|n| n.trim().to_string()),
            is_active: true,
            is_default: matches!(cmd.code.trim(), "120301" | "220301"),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.account_repo
            .save(&account)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        Ok(account)
    }

    pub async fn update_account(
        &self,
        id: AccountId,
        cmd: CreateAccountCommand,
    ) -> Result<Account, AccountUseCaseError> {
        let opening_balance = Decimal::from_str(&cmd.opening_balance)
            .map_err(|e| AccountUseCaseError::InvalidDecimal(e.to_string()))?;

        let mut account = self
            .account_repo
            .find_by_id(&id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
            .ok_or(AccountUseCaseError::AccountNotFound)?;

        let was_root = account.parent_id.is_none();

        self.validate_names_and_code(&cmd)?;
        self.ensure_code_not_exists(&cmd.code, Some(&id)).await?;
        self.validate_parent_and_level(&cmd).await?;
        self.validate_category_rules(&cmd).await?;
        self.validate_type_hierarchy(&cmd).await?;
        self.validate_no_self_parent(&id, cmd.parent_id.as_ref())?;

        // Root safety: system roots cannot be demoted or changed type.
        self.protect_root_policy_on_update(&account, &cmd, was_root)?;

        account.code = cmd.code.trim().to_string();
        account.name_ar = cmd.name_ar.trim().to_string();
        account.name_en = cmd.name_en.trim().to_string();
        account.account_type = cmd.account_type;
        account.parent_id = cmd.parent_id;
        account.category = cmd.category;
        account.level = cmd.level;
        account.opening_balance = opening_balance;
        account.notes = cmd.notes.map(|n| n.trim().to_string());
        account.updated_at = Utc::now();

        self.account_repo
            .save(&account)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        Ok(account)
    }

    /// Soft delete behavior:
    /// - If account has journal usage or children => deactivate (is_active=false)
    /// - If no usage and no children => hard delete allowed
    /// - Root accounts are never deleted; only deactivated
    pub async fn delete_account(&self, id: AccountId) -> Result<(), AccountUseCaseError> {
        let mut account = self
            .account_repo
            .find_by_id(&id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
            .ok_or(AccountUseCaseError::AccountNotFound)?;

        let all_accounts = self
            .account_repo
            .list_all()
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        let has_children = all_accounts
            .iter()
            .any(|a| a.parent_id.as_ref() == Some(&id));
        let usage = self.count_journal_usage(&id).await?;
        let is_root = account.parent_id.is_none();

        if is_root || has_children || usage > 0 {
            account.is_active = false;
            account.updated_at = Utc::now();
            self.account_repo
                .save(&account)
                .await
                .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
            return Ok(());
        }

        self.account_repo
            .delete(&id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        Ok(())
    }

    pub async fn set_account_active(
        &self,
        id: AccountId,
        active: bool,
    ) -> Result<Account, AccountUseCaseError> {
        let mut account = self
            .account_repo
            .find_by_id(&id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
            .ok_or(AccountUseCaseError::AccountNotFound)?;

        if !active {
            self.ensure_can_deactivate(&id, &account).await?;
            account.is_active = false;
        } else {
            self.ensure_can_activate(&account).await?;
            account.is_active = true;
        }

        account.updated_at = Utc::now();

        self.account_repo
            .save(&account)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        Ok(account)
    }

    async fn ensure_code_not_exists(
        &self,
        code: &str,
        current_id: Option<&AccountId>,
    ) -> Result<(), AccountUseCaseError> {
        if let Some(existing) = self
            .account_repo
            .find_by_code(code.trim())
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
        {
            if current_id.map(|x| x != &existing.id).unwrap_or(true) {
                return Err(AccountUseCaseError::CodeExists(code.to_string()));
            }
        }
        Ok(())
    }

    fn validate_names_and_code(
        &self,
        cmd: &CreateAccountCommand,
    ) -> Result<(), AccountUseCaseError> {
        if cmd.code.trim().is_empty() {
            return Err(AccountUseCaseError::Validation("كود الحساب مطلوب".into()));
        }
        if cmd.name_ar.trim().is_empty() {
            return Err(AccountUseCaseError::Validation(
                "اسم الحساب بالعربية مطلوب".into(),
            ));
        }
        if cmd.name_en.trim().is_empty() {
            return Err(AccountUseCaseError::Validation(
                "اسم الحساب بالإنجليزية مطلوب".into(),
            ));
        }
        if cmd.level < 1 {
            return Err(AccountUseCaseError::Validation(
                "المستوى يجب أن يكون 1 أو أكثر".into(),
            ));
        }
        Ok(())
    }

    async fn validate_parent_and_level(
        &self,
        cmd: &CreateAccountCommand,
    ) -> Result<(), AccountUseCaseError> {
        match &cmd.parent_id {
            None => {
                if cmd.level != 1 {
                    return Err(AccountUseCaseError::Validation(
                        "الحساب بدون أب يجب أن يكون في المستوى 1".into(),
                    ));
                }
            }
            Some(parent_id) => {
                let parent = self
                    .account_repo
                    .find_by_id(parent_id)
                    .await
                    .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
                    .ok_or(AccountUseCaseError::ParentNotFound)?;

                if parent.category != AccountCategory::Summary {
                    return Err(AccountUseCaseError::Validation(
                        "لا يمكن إضافة حساب فرعي تحت حساب تفصيلي".into(),
                    ));
                }

                if cmd.level != parent.level + 1 {
                    return Err(AccountUseCaseError::Validation(format!(
                        "المستوى غير صحيح. المستوى المتوقع هو {}",
                        parent.level + 1
                    )));
                }
            }
        }
        Ok(())
    }

    async fn validate_category_rules(
        &self,
        cmd: &CreateAccountCommand,
    ) -> Result<(), AccountUseCaseError> {
        // Top-level accounts should be summary.
        if cmd.level == 1 && cmd.category != AccountCategory::Summary {
            return Err(AccountUseCaseError::Validation(
                "حسابات المستوى الأول يجب أن تكون تجميعية".into(),
            ));
        }

        // Detail account may be created under summary only (already checked in parent validation).
        Ok(())
    }

    async fn validate_type_hierarchy(
        &self,
        cmd: &CreateAccountCommand,
    ) -> Result<(), AccountUseCaseError> {
        if let Some(parent_id) = &cmd.parent_id {
            let parent = self
                .account_repo
                .find_by_id(parent_id)
                .await
                .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
                .ok_or(AccountUseCaseError::ParentNotFound)?;

            // Strict type consistency, except Equity allowed under liabilities branch (as current COA design).
            let allowed = parent.account_type == cmd.account_type
                || (parent.account_type == AccountType::Liabilities
                    && cmd.account_type == AccountType::Equity);

            if !allowed {
                return Err(AccountUseCaseError::Validation(
                    "نوع الحساب الفرعي غير متوافق مع نوع الحساب الأب".into(),
                ));
            }
        }
        Ok(())
    }

    fn validate_no_self_parent(
        &self,
        id: &AccountId,
        parent_id: Option<&AccountId>,
    ) -> Result<(), AccountUseCaseError> {
        if parent_id == Some(id) {
            return Err(AccountUseCaseError::Validation(
                "لا يمكن أن يكون الحساب أبًا لنفسه".into(),
            ));
        }
        Ok(())
    }

    fn protect_root_policy_on_create(
        &self,
        cmd: &CreateAccountCommand,
    ) -> Result<(), AccountUseCaseError> {
        // Required roots:
        // 1 Assets, 2 Liabilities, 3 Revenue, 4 Expenses
        if cmd.parent_id.is_none() {
            let ok = matches!(
                (cmd.code.trim(), &cmd.account_type),
                ("1", AccountType::Assets)
                    | ("2", AccountType::Liabilities)
                    | ("3", AccountType::Revenue)
                    | ("4", AccountType::Expenses)
            );
            if !ok {
                return Err(AccountUseCaseError::Forbidden(
                    "لا يمكن إنشاء حساب جذري خارج الجذور الأساسية المعتمدة".into(),
                ));
            }
        }
        Ok(())
    }

    fn protect_root_policy_on_update(
        &self,
        current: &Account,
        cmd: &CreateAccountCommand,
        was_root: bool,
    ) -> Result<(), AccountUseCaseError> {
        if !was_root {
            return Ok(());
        }

        let current_code = current.code.trim();
        let required = matches!(current_code, "1" | "2" | "3" | "4");

        if required {
            if cmd.parent_id.is_some() {
                return Err(AccountUseCaseError::Forbidden(
                    "لا يمكن تحويل الحساب الجذري الأساسي إلى حساب فرعي".into(),
                ));
            }

            let type_ok = matches!(
                (current_code, &cmd.account_type),
                ("1", AccountType::Assets)
                    | ("2", AccountType::Liabilities)
                    | ("3", AccountType::Revenue)
                    | ("4", AccountType::Expenses)
            );

            if !type_ok {
                return Err(AccountUseCaseError::Forbidden(
                    "لا يمكن تغيير نوع الحساب الجذري الأساسي".into(),
                ));
            }

            if cmd.code.trim() != current_code {
                return Err(AccountUseCaseError::Forbidden(
                    "لا يمكن تغيير كود الحساب الجذري الأساسي".into(),
                ));
            }
        }

        Ok(())
    }

    async fn ensure_can_deactivate(
        &self,
        id: &AccountId,
        account: &Account,
    ) -> Result<(), AccountUseCaseError> {
        if account.parent_id.is_none() && matches!(account.code.as_str(), "1" | "2" | "3" | "4") {
            return Err(AccountUseCaseError::Forbidden(
                "لا يمكن تعطيل الحسابات الجذرية الأساسية".into(),
            ));
        }

        let entries = self
            .journal_repo
            .list_by_account(id)
            .await
            .map_err(|e| AccountUseCaseError::JournalRepositoryError(e.to_string()))?;

        let has_open_posting = entries
            .iter()
            .any(|e| e.status == JournalEntryStatus::Draft);

        if has_open_posting {
            return Err(AccountUseCaseError::Forbidden(
                "لا يمكن تعطيل حساب مستخدم في قيد مسودة/مفتوح".into(),
            ));
        }

        Ok(())
    }

    async fn ensure_can_activate(&self, account: &Account) -> Result<(), AccountUseCaseError> {
        if let Some(parent_id) = &account.parent_id {
            let parent = self
                .account_repo
                .find_by_id(parent_id)
                .await
                .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
                .ok_or(AccountUseCaseError::ParentNotFound)?;

            if !parent.is_active {
                return Err(AccountUseCaseError::Forbidden(
                    "لا يمكن تفعيل الحساب لأن الحساب الأب معطل".into(),
                ));
            }
        }
        Ok(())
    }

    async fn count_journal_usage(&self, id: &AccountId) -> Result<usize, AccountUseCaseError> {
        let entries = self
            .journal_repo
            .list_by_account(id)
            .await
            .map_err(|e| AccountUseCaseError::JournalRepositoryError(e.to_string()))?;
        Ok(entries.len())
    }
}
