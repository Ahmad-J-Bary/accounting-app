use std::sync::Arc;
use std::collections::HashMap;
use rust_decimal::Decimal;
use domain::accounting::account::Account;
use domain::shared::ids::{AccountId};
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::account_dto::AccountDto;
use super::error::AccountUseCaseError;
use super::types::{AccountLedger, LedgerLine};

pub struct AccountQueries {
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl AccountQueries {
    pub fn new(
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            account_repo,
            journal_repo,
        }
    }

    pub async fn get_chart_of_accounts(&self) -> Result<Vec<AccountDto>, AccountUseCaseError> {
        let accounts = self.account_repo
            .list_all()
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        let mut account_map: HashMap<AccountId, Account> = HashMap::new();
        let mut children_map: HashMap<AccountId, Vec<AccountId>> = HashMap::new();
        let mut roots: Vec<AccountId> = Vec::new();

        for account in accounts {
            let id = account.id;
            if let Some(parent_id) = &account.parent_id {
                children_map.entry(*parent_id).or_default().push(id);
            } else {
                roots.push(id);
            }
            account_map.insert(id, account);
        }

        fn calculate_balance(
            node_id: &AccountId,
            account_map: &mut HashMap<AccountId, Account>,
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
            
            account_map.get(node_id).map(|a| a.balance).unwrap_or(Decimal::ZERO)
        }

        for root_id in &roots {
            calculate_balance(root_id, &mut account_map, &children_map);
        }

        let mut result_accounts: Vec<_> = account_map.into_values().collect();
        result_accounts.sort_by(|a, b| a.code.cmp(&b.code));

        Ok(result_accounts.into_iter().map(AccountDto::from).collect())
    }

    pub async fn list_all(&self) -> Result<Vec<AccountDto>, AccountUseCaseError> {
        let accounts = self.account_repo
            .list_all()
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        Ok(accounts.into_iter().map(AccountDto::from).collect())
    }

    pub async fn find_by_id(&self, id: &AccountId) -> Result<Option<AccountDto>, AccountUseCaseError> {
        let account = self.account_repo
            .find_by_id(id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        Ok(account.map(AccountDto::from))
    }

    pub async fn get_ledger(&self, account_id: &AccountId) -> Result<AccountLedger, AccountUseCaseError> {
        let account = self.account_repo
            .find_by_id(account_id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
            .ok_or(AccountUseCaseError::AccountNotFound)?;

        let journal_entries = self.journal_repo
            .list_by_account(account_id)
            .await
            .map_err(|e| AccountUseCaseError::JournalRepositoryError(e.to_string()))?;

        let mut lines = Vec::new();
        let mut running_balance = account.opening_balance;

        let mut sorted_entries = journal_entries;
        sorted_entries.sort_by(|a, b| a.created_at.cmp(&b.created_at));

        for entry in sorted_entries {
            if let Some(line) = entry.lines.iter().find(|l| l.account_id == *account_id) {
                let debit = line.base_debit();
                let credit = line.base_credit();
                
                running_balance += debit - credit;
                
                lines.push(LedgerLine {
                    date: entry.entry_date,
                    journal_id: entry.id,
                    description: entry.description.clone(),
                    debit,
                    credit,
                    balance: running_balance,
                });
            }
        }

        let total_debit = lines.iter().map(|l| l.debit).sum();
        let total_credit = lines.iter().map(|l| l.credit).sum();

        Ok(AccountLedger {
            account_id: account.id,
            account_name: account.name_ar,
            opening_balance: account.opening_balance,
            lines,
            total_debit,
            total_credit,
            closing_balance: running_balance,
        })
    }
}
