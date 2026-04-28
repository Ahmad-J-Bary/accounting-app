use crate::ports::account_repository::AccountRepository;
use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::shared::ids::AccountId;
use super::error::AccountUseCaseError;
use super::types::CreateAccountCommand;

pub struct AccountValidation;

impl AccountValidation {
    pub async fn ensure_code_not_exists(
        repo: &dyn AccountRepository,
        code: &str,
        current_id: Option<&AccountId>,
    ) -> Result<(), AccountUseCaseError> {
        if let Some(existing) = repo
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

    pub fn validate_names_and_code(cmd: &CreateAccountCommand) -> Result<(), AccountUseCaseError> {
        if cmd.code.trim().is_empty() {
            return Err(AccountUseCaseError::Validation("كود الحساب مطلوب".into()));
        }
        if cmd.name_ar.trim().is_empty() {
            return Err(AccountUseCaseError::Validation("اسم الحساب بالعربية مطلوب".into()));
        }
        if cmd.name_en.trim().is_empty() {
            return Err(AccountUseCaseError::Validation("اسم الحساب بالإنجليزية مطلوب".into()));
        }
        if cmd.level < 1 {
            return Err(AccountUseCaseError::Validation("المستوى يجب أن يكون 1 أو أكثر".into()));
        }
        Ok(())
    }

    pub async fn validate_parent_and_level(
        repo: &dyn AccountRepository,
        cmd: &CreateAccountCommand,
    ) -> Result<(), AccountUseCaseError> {
        match &cmd.parent_id {
            None => {
                if cmd.level != 1 {
                    return Err(AccountUseCaseError::Validation("الحساب بدون أب يجب أن يكون في المستوى 1".into()));
                }
            }
            Some(parent_id) => {
                let parent = repo
                    .find_by_id(parent_id)
                    .await
                    .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
                    .ok_or(AccountUseCaseError::ParentNotFound)?;

                if parent.category != AccountCategory::Summary {
                    return Err(AccountUseCaseError::Validation("لا يمكن إضافة حساب فرعي تحت حساب تفصيلي".into()));
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

    pub async fn validate_type_hierarchy(
        repo: &dyn AccountRepository,
        cmd: &CreateAccountCommand,
    ) -> Result<(), AccountUseCaseError> {
        if let Some(parent_id) = &cmd.parent_id {
            let parent = repo
                .find_by_id(parent_id)
                .await
                .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
                .ok_or(AccountUseCaseError::ParentNotFound)?;

            let allowed = parent.account_type == cmd.account_type
                || (parent.account_type == AccountType::Liabilities && cmd.account_type == AccountType::Equity);

            if !allowed {
                return Err(AccountUseCaseError::Validation("نوع الحساب الفرعي غير متوافق مع نوع الحساب الأب".into()));
            }
        }
        Ok(())
    }

    pub fn protect_root_policy_on_create(cmd: &CreateAccountCommand) -> Result<(), AccountUseCaseError> {
        if cmd.parent_id.is_none() {
            let ok = matches!(
                (cmd.code.trim(), &cmd.account_type),
                ("1", AccountType::Assets)
                    | ("2", AccountType::Liabilities)
                    | ("3", AccountType::Revenue)
                    | ("4", AccountType::Expenses)
            );
            if !ok {
                return Err(AccountUseCaseError::Forbidden("لا يمكن إنشاء حساب جذري خارج الجذور الأساسية المعتمدة".into()));
            }
        }
        Ok(())
    }

    pub fn protect_root_policy_on_update(
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
                return Err(AccountUseCaseError::Forbidden("لا يمكن تحويل الحساب الجذري الأساسي إلى حساب فرعي".into()));
            }

            let type_ok = matches!(
                (current_code, &cmd.account_type),
                ("1", AccountType::Assets)
                    | ("2", AccountType::Liabilities)
                    | ("3", AccountType::Revenue)
                    | ("4", AccountType::Expenses)
            );

            if !type_ok {
                return Err(AccountUseCaseError::Forbidden("لا يمكن تغيير نوع الحساب الجذري الأساسي".into()));
            }

            if cmd.code.trim() != current_code {
                return Err(AccountUseCaseError::Forbidden("لا يمكن تغيير كود الحساب الجذري الأساسي".into()));
            }
        }

        Ok(())
    }
}
