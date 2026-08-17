use super::error::AccountUseCaseError;
use super::types::{AccountLedger, LedgerLine, LedgerOpeningInfo};
use crate::dto::account_dto::AccountDto;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use domain::accounting::account::Account;
use domain::shared::ids::AccountId;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::Arc;

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
        let accounts = self
            .account_repo
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

            account_map
                .get(node_id)
                .map(|a| a.balance)
                .unwrap_or(Decimal::ZERO)
        }

        for root_id in &roots {
            calculate_balance(root_id, &mut account_map, &children_map);
        }

        let mut result_accounts: Vec<_> = account_map.into_values().collect();
        result_accounts.sort_by(|a, b| a.code.cmp(&b.code));

        Ok(result_accounts.into_iter().map(AccountDto::from).collect())
    }

    pub async fn list_all(&self) -> Result<Vec<AccountDto>, AccountUseCaseError> {
        let accounts = self
            .account_repo
            .list_all()
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        Ok(accounts.into_iter().map(AccountDto::from).collect())
    }

    pub async fn find_by_id(
        &self,
        id: &AccountId,
    ) -> Result<Option<AccountDto>, AccountUseCaseError> {
        let account = self
            .account_repo
            .find_by_id(id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        Ok(account.map(AccountDto::from))
    }

    pub async fn get_ledger(
        &self,
        account_ids: &[AccountId],
    ) -> Result<AccountLedger, AccountUseCaseError> {
        if account_ids.is_empty() {
            return Err(AccountUseCaseError::AccountNotFound);
        }

        let first_account = self
            .account_repo
            .find_by_id(&account_ids[0])
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
            .ok_or(AccountUseCaseError::AccountNotFound)?;

        let all_accounts = self
            .account_repo
            .list_all()
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        let mut account_info_map: HashMap<AccountId, (String, String)> = HashMap::new();
        let mut opening_balance_map: HashMap<AccountId, Decimal> = HashMap::new();
        for acc in &all_accounts {
            account_info_map.insert(acc.id, (acc.code.clone(), acc.name_ar.clone()));
            opening_balance_map.insert(acc.id, acc.opening_balance);
        }

        let id_set: std::collections::HashSet<AccountId> = account_ids.iter().copied().collect();

        let journal_entries = self
            .journal_repo
            .list_by_accounts(account_ids)
            .await
            .map_err(|e| AccountUseCaseError::JournalRepositoryError(e.to_string()))?;

        let static_opening: Decimal = account_ids
            .iter()
            .map(|id| opening_balance_map.get(id).copied().unwrap_or(Decimal::ZERO))
            .sum();

        // The opening balance is the account's STATIC opening (existing-company
        // seed / registered capital). Opening JOURNAL lines are themselves real
        // posted lines surfaced in `lines` (or diverted into `opening_entries`
        // when a static balance exists), so they must never be folded into the
        // opening balance again — the frontend's beginning balance is
        // SUM(posted lines before from_date), not this field plus lines.
        let opening_balance = static_opening;

        let mut lines = Vec::new();
        let mut opening_entry: Option<LedgerOpeningInfo> = None;
        let mut opening_entries: Vec<LedgerOpeningInfo> = Vec::new();
        // The GL starts from the account's opening position (static opening only;
        // opening journal lines are already in `lines` for non-static accounts),
        // so running and closing balances follow rule 6: Beginning + Dr - Cr.
        // `opening_balance` is a magnitude; it lands on the account's normal
        // side (credit-normal accounts carry it as a negative debit - credit net).
        let signed_opening = match first_account.normal_balance() {
            domain::accounting::account::NormalBalance::Debit => opening_balance,
            domain::accounting::account::NormalBalance::Credit => -opening_balance,
        };
        let mut running_balance_base = signed_opening;
        let mut running_balance_original = Decimal::ZERO;

        let mut sorted_entries = journal_entries;
        // The GL runs on the ACCOUNTING date (`entry_date`), never `created_at`.
        // `created_at` is only a tiebreak so simultaneous backdated postings keep
        // a deterministic order.
        sorted_entries.sort_by(|a, b| {
            a.entry_date
                .cmp(&b.entry_date)
                .then_with(|| a.created_at.cmp(&b.created_at))
        });

        for entry in sorted_entries {
            let account_lines: Vec<_> = entry
                .lines
                .iter()
                .filter(|l| id_set.contains(&l.account_id))
                .collect();
            if account_lines.is_empty() {
                continue;
            }

            // Skip opening journals for accounts that have a static
            // opening_balance in the DB — the synthetic opening row already
            // represents this balance in the frontend. Every such opening entry
            // is kept in `opening_entries` so the frontend can aggregate ALL
            // opening balances (not just the latest one).
            let is_static_opening = matches!(
                entry.journal_type,
                domain::accounting::JournalType::AccountOpeningBalance
                    | domain::accounting::JournalType::CashOpeningBalance
                    | domain::accounting::JournalType::MaterialOpeningBalance
            );
            if is_static_opening
                && account_lines.iter().any(|l| {
                    opening_balance_map.get(&l.account_id).copied().unwrap_or(Decimal::ZERO) > Decimal::ZERO
                })
            {
                for line in &account_lines {
                    let info = LedgerOpeningInfo {
                        entry_number: entry.entry_number.clone(),
                        description: line.description.clone(),
                        date: entry.entry_date,
                        debit_base: line.base_debit(),
                        credit_base: line.base_credit(),
                    };
                    if opening_entry.is_none() {
                        opening_entry = Some(info.clone());
                    }
                    opening_entries.push(info);
                }
                continue;
            }

            let opposite_lines: Vec<_> = entry
                .lines
                .iter()
                .filter(|l| !id_set.contains(&l.account_id))
                .collect();
            let opposite_account_name = if opposite_lines.len() == 1 {
                account_info_map
                    .get(&opposite_lines[0].account_id)
                    .map(|(_, name)| name.clone())
                    .unwrap_or_else(|| "-".to_string())
            } else if opposite_lines.is_empty() {
                "-".to_string()
            } else if let Some(partner_line) = opposite_lines.iter().find(|l| l.partner_id.is_some()) {
                    account_info_map
                        .get(&partner_line.account_id)
                        .map(|(_, name)| name.clone())
                        .unwrap_or_else(|| "-".to_string())
            } else {
                "حسابات متعددة".to_string()
            };

            let effective_type = if entry.journal_type == domain::accounting::JournalType::GeneralJournal {
                let is_discount_granted = entry.lines.iter().any(|l| {
                    account_info_map.get(&l.account_id)
                        .map(|(code, name)| code.as_str() == "47" || name.contains("خصوم ممنوحة"))
                        .unwrap_or(false)
                });
                let is_discount_earned = entry.lines.iter().any(|l| {
                    account_info_map.get(&l.account_id)
                        .map(|(code, name)| code.as_str() == "332" || name.contains("خصوم مكتسبة"))
                        .unwrap_or(false)
                });
                if is_discount_granted {
                    domain::accounting::JournalType::DiscountGrantedJournal
                } else if is_discount_earned {
                    domain::accounting::JournalType::DiscountEarnedJournal
                } else {
                    entry.journal_type
                }
            } else {
                entry.journal_type
            };

            for line in account_lines {
                let debit_base = line.base_debit();
                let credit_base = line.base_credit();

                let debit_original = if line.debit.fx_rate != Decimal::ONE {
                    line.debit.amount()
                } else {
                    Decimal::ZERO
                };
                let credit_original = if line.credit.fx_rate != Decimal::ONE {
                    line.credit.amount()
                } else {
                    Decimal::ZERO
                };

                running_balance_base += debit_base - credit_base;
                running_balance_original += debit_original - credit_original;

                let (currency, fx_rate) = if line.debit.amount() > Decimal::ZERO {
                    (line.debit.currency().code.clone(), line.debit.fx_rate)
                } else {
                    (line.credit.currency().code.clone(), line.credit.fx_rate)
                };

                lines.push(LedgerLine {
                    date: entry.entry_date,
                    journal_id: entry.id,
                    entry_number: entry.entry_number.clone(),
                    journal_type: effective_type,
                    source_id: entry.source_id.clone(),
                    description: line.description.clone(),
                    opposite_account_name: opposite_account_name.clone(),
                    currency,
                    fx_rate,
                    debit_base,
                    credit_base,
                    balance_base: running_balance_base,
                    debit_original,
                    credit_original,
                    balance_original: running_balance_original,
                });
            }
        }

        let total_debit_base = lines.iter().map(|l| l.debit_base).sum();
        let total_credit_base = lines.iter().map(|l| l.credit_base).sum();
        let total_debit_original = lines.iter().map(|l| l.debit_original).sum();
        let total_credit_original = lines.iter().map(|l| l.credit_original).sum();

        let account_name = if account_ids.len() == 1 {
            first_account.name_ar.clone()
        } else {
            format!("{} + {} حسابات فرعية", first_account.name_ar, account_ids.len() - 1)
        };

        Ok(AccountLedger {
            account_id: first_account.id,
            account_name,
            opening_balance_base: opening_balance,
            opening_balance_original: Decimal::ZERO,
            opening_entry,
            opening_entries,
            lines,
            total_debit_base,
            total_credit_base,
            closing_balance_base: running_balance_base,
            total_debit_original,
            total_credit_original,
            closing_balance_original: running_balance_original,
        })
    }

    pub async fn get_expense_items(&self) -> Result<Vec<AccountDto>, AccountUseCaseError> {
        let accounts = self
            .account_repo
            .list_all()
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        // Filter for "Other Expenses" children only
        let parent_id_str = crate::constants::EXPENSES_PARENT_ID;

        let mut expense_items: Vec<AccountDto> = accounts
            .into_iter()
            .filter(|a| {
                a.parent_id
                    .as_ref()
                    .map(|id| id.0.to_string() == parent_id_str)
                    .unwrap_or(false)
            })
            .map(AccountDto::from)
            .collect();

        expense_items.sort_by(|a, b| a.code.cmp(&b.code));

        Ok(expense_items)
    }
}
