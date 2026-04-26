use std::sync::Arc;
use std::collections::HashMap;
use domain::shared::ids::AccountId;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::dto::account_dto::AccountDto;
use rust_decimal::Decimal;

pub struct GetChartOfAccountsUseCase {
    repo: Arc<dyn AccountRepository>,
}

impl GetChartOfAccountsUseCase {
    pub fn new(repo: Arc<dyn AccountRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<AccountDto>, AppError> {
        let accounts = self.repo.list_all().await?;
        
        let mut account_map = HashMap::new();
        let mut children_map: HashMap<AccountId, Vec<AccountId>> = HashMap::new();
        let mut roots = Vec::new();

        for account in accounts {
            let id = account.id.clone();
            if let Some(parent_id) = &account.parent_id {
                children_map.entry(parent_id.clone()).or_default().push(id.clone());
            } else {
                roots.push(id.clone());
            }
            account_map.insert(id, account);
        }

        // Recursive function to calculate balances
        fn calculate_balance(
            node_id: &AccountId,
            account_map: &mut HashMap<AccountId, domain::accounting::account::Account>,
            children_map: &HashMap<AccountId, Vec<AccountId>>,
        ) -> Decimal {
            if let Some(children) = children_map.get(node_id) {
                if !children.is_empty() {
                    let mut sum = Decimal::ZERO;
                    for child_id in children {
                        sum += calculate_balance(child_id, account_map, children_map);
                    }
                    if let Some(node) = account_map.get_mut(node_id) {
                        node.balance = sum;
                    }
                    return sum;
                }
            }
            
            // If no children, return its own balance
            account_map.get(node_id).map(|a| a.balance).unwrap_or(Decimal::ZERO)
        }

        for root_id in &roots {
            calculate_balance(root_id, &mut account_map, &children_map);
        }

        Ok(account_map.into_values().map(AccountDto::from).collect())
    }
}
