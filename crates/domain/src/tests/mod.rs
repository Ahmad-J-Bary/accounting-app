// ============================================================
// Domain Tests — Arabic ERP System
// Uses crate:: paths since tests live inside the domain crate
// ============================================================

/*
#[cfg(test)]
mod product_domain_tests {
    ...
}
*/

#[cfg(test)]
mod stock_movement_domain_tests {
    use crate::inventory::stock_movement::{MovementType, StockMovement};
    use crate::shared::ids::MaterialId;
    use chrono::Utc;
    use rust_decimal::Decimal;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    #[test]
    fn new_movement_succeeds() {
        let m = StockMovement::new(
            MaterialId(Uuid::new_v4()),
            MovementType::In,
            dec!(10),
            dec!(5),
            dec!(50),
            "REF-001".to_string(),
            "Initial stock".to_string(),
            Utc::now(),
        );
        assert!(m.is_ok());
    }

    #[test]
    fn negative_quantity_movement_fails() {
        let r = StockMovement::new(
            MaterialId(Uuid::new_v4()),
            MovementType::In,
            dec!(-10),
            dec!(5),
            dec!(-50),
            "REF-001".to_string(),
            "".to_string(),
            Utc::now(),
        );
        assert!(r.is_err());
    }

    #[test]
    fn zero_quantity_movement_fails() {
        let r = StockMovement::new(
            MaterialId(Uuid::new_v4()),
            MovementType::In,
            Decimal::ZERO,
            Decimal::ZERO,
            Decimal::ZERO,
            "REF".to_string(),
            "".to_string(),
            Utc::now(),
        );
        assert!(r.is_err());
    }
}

#[cfg(test)]
mod accounting_domain_tests {
    use crate::shared::currency::Currency;
    use crate::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
    use crate::shared::ids::AccountId;
    use crate::shared::monetary_amount::MonetaryAmount;
    use crate::shared::money::Money;
    use chrono::Utc;
    use rust_decimal::Decimal;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    fn test_currency() -> Currency {
        Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
    }

    fn balanced_lines(amount: Decimal) -> Vec<JournalLine> {
        let c = test_currency();
        vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::new(amount, c.clone()), dec!(1)),
                MonetaryAmount::zero(c.clone()),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(c.clone()),
                MonetaryAmount::new(Money::new(amount, c.clone()), dec!(1)),
                "دائن".to_string(),
            ),
        ]
    }

    #[test]
    fn balanced_journal_entry_succeeds() {
        let lines = balanced_lines(dec!(100));
        let r = JournalEntry::new(
            "JE-001".to_string(),
            JournalType::GeneralJournal,
            lines,
            Utc::now(),
            "قيد متوازن".to_string(),
            None,
        );
        assert!(r.is_ok());
    }

    #[test]
    fn unbalanced_journal_entry_post_fails() {
        let c = test_currency();
        let lines = vec![JournalLine::new(
            AccountId(Uuid::new_v4()),
            MonetaryAmount::new(Money::new(dec!(100), c.clone()), dec!(1)),
            MonetaryAmount::zero(c.clone()),
            "مدين غير متوازن".to_string(),
        )];
        let mut entry = JournalEntry::new(
            "JE-ERR".to_string(),
            JournalType::GeneralJournal,
            lines,
            Utc::now(),
            "قيد غير متوازن".to_string(),
            None,
        )
        .unwrap();

        let result = entry.post();
        assert!(result.is_err());
    }

    #[test]
    fn entry_without_lines_fails() {
        let r = JournalEntry::new(
            "JE-EMPTY".to_string(),
            JournalType::GeneralJournal,
            vec![],
            Utc::now(),
            "فارغ".to_string(),
            None,
        );
        assert!(r.is_err());
    }

    #[test]
    fn opening_stock_journal_entry_is_balanced() {
        let amount = dec!(150000);
        let mut e = JournalEntry::new(
            "JE-OP-001".to_string(),
            JournalType::AccountOpeningBalance,
            balanced_lines(amount),
            Utc::now(),
            "قيد بضاعة أول المدة".to_string(),
            None,
        )
        .unwrap();
        assert!(e.post().is_ok());
    }

    #[test]
    fn cash_receipt_journal_entry_is_properly_categorized() {
        let lines = balanced_lines(dec!(1000));
        let entry = JournalEntry::new(
            "CR-001".to_string(),
            JournalType::CashReceipt,
            lines,
            Utc::now(),
            "سند قبض تجريبي".to_string(),
            None,
        ).unwrap();
        
        assert_eq!(entry.journal_type, JournalType::CashReceipt);
        assert!(entry.is_balanced());
    }

    #[test]
    fn line_based_display_logic_verification() {
        let lines = balanced_lines(dec!(500));
        // Verify line 0 is Debit and line 1 is Credit
        assert!(lines[0].base_debit() > Decimal::ZERO);
        assert_eq!(lines[0].base_credit(), Decimal::ZERO);
        
        assert!(lines[1].base_credit() > Decimal::ZERO);
        assert_eq!(lines[1].base_debit(), Decimal::ZERO);
    }

    #[test]
    fn specialized_journals_for_sales_and_purchases() {
        let entry_sales = JournalEntry::new(
            "SJ-001".to_string(),
            JournalType::CashSalesJournal,
            balanced_lines(dec!(100)),
            Utc::now(),
            "مبيعات".to_string(),
            None,
        ).unwrap();
        assert_eq!(entry_sales.journal_type, JournalType::CashSalesJournal);

        let entry_purchase = JournalEntry::new(
            "PJ-001".to_string(),
            JournalType::PurchaseJournal,
            balanced_lines(dec!(100)),
            Utc::now(),
            "مشتريات".to_string(),
            None,
        ).unwrap();
        assert_eq!(entry_purchase.journal_type, JournalType::PurchaseJournal);
        
        let entry_costs = JournalEntry::new(
            "PCJ-001".to_string(),
            JournalType::PurchaseCostsJournal,
            balanced_lines(dec!(100)),
            Utc::now(),
            "تكاليف إضافية".to_string(),
            None,
        ).unwrap();
        assert_eq!(entry_costs.journal_type, JournalType::PurchaseCostsJournal);
    }
}
