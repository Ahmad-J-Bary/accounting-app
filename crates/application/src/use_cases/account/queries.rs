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

        let all_accounts = self.account_repo.list_all().await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        let mut account_name_map: HashMap<AccountId, String> = HashMap::new();
        for acc in all_accounts {
            account_name_map.insert(acc.id, acc.name_ar);
        }

        let journal_entries = self.journal_repo
            .list_by_account(account_id)
            .await
            .map_err(|e| AccountUseCaseError::JournalRepositoryError(e.to_string()))?;

        let mut lines = Vec::new();
        let mut running_balance_syp = account.opening_balance;
        let mut running_balance_usd = Decimal::ZERO;

        let mut sorted_entries = journal_entries;
        sorted_entries.sort_by(|a, b| a.created_at.cmp(&b.created_at));

        for entry in sorted_entries {
            let account_lines: Vec<_> = entry.lines.iter().filter(|l| l.account_id == *account_id).collect();
            if account_lines.is_empty() { continue; }

            let opposite_lines: Vec<_> = entry.lines.iter().filter(|l| l.account_id != *account_id).collect();
            let opposite_account_name = if opposite_lines.len() == 1 {
                account_name_map.get(&opposite_lines[0].account_id).cloned().unwrap_or_else(|| "-".to_string())
            } else if opposite_lines.is_empty() {
                "-".to_string()
            } else {
                "حسابات متعددة".to_string()
            };

            for line in account_lines {
                let debit_syp = line.base_debit();
                let credit_syp = line.base_credit();
                
                let debit_usd = if line.debit.currency().code.to_uppercase() == "USD" { line.debit.amount() } else { Decimal::ZERO };
                let credit_usd = if line.credit.currency().code.to_uppercase() == "USD" { line.credit.amount() } else { Decimal::ZERO };

                running_balance_syp += debit_syp - credit_syp;
                running_balance_usd += debit_usd - credit_usd;
                
                let (currency, fx_rate) = if line.debit.amount() > Decimal::ZERO {
                    (line.debit.currency().code.clone(), line.debit.fx_rate)
                } else {
                    (line.credit.currency().code.clone(), line.credit.fx_rate)
                };

                lines.push(LedgerLine {
                    date: entry.entry_date,
                    journal_id: entry.id,
                    entry_number: entry.entry_number.clone(),
                    journal_type: entry.journal_type.clone(),
                    source_id: entry.source_id.clone(),
                    description: line.description.clone(),
                    opposite_account_name: opposite_account_name.clone(),
                    currency,
                    fx_rate,
                    debit_syp,
                    credit_syp,
                    balance_syp: running_balance_syp,
                    debit_usd,
                    credit_usd,
                    balance_usd: running_balance_usd,
                });
            }
        }

        let total_debit_syp = lines.iter().map(|l| l.debit_syp).sum();
        let total_credit_syp = lines.iter().map(|l| l.credit_syp).sum();
        let total_debit_usd = lines.iter().map(|l| l.debit_usd).sum();
        let total_credit_usd = lines.iter().map(|l| l.credit_usd).sum();

        Ok(AccountLedger {
            account_id: account.id,
            account_name: account.name_ar,
            opening_balance_syp: account.opening_balance,
            opening_balance_usd: Decimal::ZERO, // Note: Global accounts only store SYP opening balance
            lines,
            total_debit_syp,
            total_credit_syp,
            closing_balance_syp: running_balance_syp,
            total_debit_usd,
            total_credit_usd,
            closing_balance_usd: running_balance_usd,
        })
    }
}
