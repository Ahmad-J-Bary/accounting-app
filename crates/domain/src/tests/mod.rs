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
    use crate::inventory::stock_movement::{StockMovement, MovementType};
    use crate::shared::ids::MaterialId;
    use uuid::Uuid;
    use rust_decimal_macros::dec;
    use chrono::Utc;

    fn mv(t: MovementType, qty: rust_decimal::Decimal) -> StockMovement {
        StockMovement::new(
            MaterialId(Uuid::new_v4()), 
            t, 
            qty,
            rust_decimal::Decimal::ZERO, 
            rust_decimal::Decimal::ZERO,
            "REF-001".to_string(), 
            "ملاحظات".to_string(), 
            Utc::now(),
        ).unwrap()
    }

    #[test]
    fn in_movement_is_inflow() {
        let m = mv(MovementType::In, dec!(100));
        assert!(m.is_inflow());
        assert!(!m.is_outflow());
    }

    #[test]
    fn out_movement_is_outflow() {
        let m = mv(MovementType::Out, dec!(50));
        assert!(m.is_outflow());
        assert!(!m.is_inflow());
    }

    #[test]
    fn opening_balance_is_inflow() {
        let m = mv(MovementType::OpeningBalance, dec!(200));
        assert!(m.is_inflow());
        assert!(!m.is_outflow());
    }

    #[test]
    fn zero_quantity_movement_fails() {
        let r = StockMovement::new(
            MaterialId(Uuid::new_v4()), 
            MovementType::In, 
            rust_decimal::Decimal::ZERO,
            rust_decimal::Decimal::ZERO, 
            rust_decimal::Decimal::ZERO,
            "REF".to_string(), 
            "".to_string(), 
            Utc::now(),
        );
        assert!(r.is_err(), "الكمية صفر يجب أن ترفض");
    }

    #[test]
    fn negative_quantity_movement_fails() {
        let r = StockMovement::new(
            MaterialId(Uuid::new_v4()), 
            MovementType::Out, 
            dec!(-10),
            rust_decimal::Decimal::ZERO, 
            rust_decimal::Decimal::ZERO,
            "REF".to_string(), 
            "".to_string(), 
            Utc::now(),
        );
        assert!(r.is_err(), "الكمية السالبة يجب أن ترفض");
    }

    #[test]
    fn empty_reference_movement_fails() {
        let r = StockMovement::new(
            MaterialId(Uuid::new_v4()), 
            MovementType::In, 
            dec!(10),
            rust_decimal::Decimal::ZERO, 
            rust_decimal::Decimal::ZERO,
            "".to_string(), 
            "".to_string(), 
            Utc::now(),
        );
        assert!(r.is_err(), "المرجع الفارغ يجب أن يُرفض");
    }
}

#[cfg(test)]
mod journal_entry_domain_tests {
    use crate::accounting::journal_entry::{JournalEntry, JournalLine};
    use crate::shared::ids::AccountId;
    use crate::shared::money::Money;
    use crate::shared::currency::Currency;
    use uuid::Uuid;
    use rust_decimal_macros::dec;
    use rust_decimal::Decimal;
    use chrono::Utc;

    fn balanced_lines(amount: rust_decimal::Decimal) -> Vec<JournalLine> {
        vec![
            JournalLine::new(AccountId(Uuid::new_v4()), Currency::SYP, Decimal::ONE,
                Money::syp(amount), Money::zero(), "مدين".to_string()),
            JournalLine::new(AccountId(Uuid::new_v4()), Currency::SYP, Decimal::ONE,
                Money::zero(), Money::syp(amount), "دائن".to_string()),
        ]
    }

    #[test]
    fn balanced_entry_posts_successfully() {
        let mut e = JournalEntry::new(
            "JE-001".to_string(), balanced_lines(dec!(50000)),
            Utc::now(), "قيد متوازن".to_string(),
        ).unwrap();
        assert!(e.post().is_ok());
    }

    #[test]
    fn unbalanced_entry_fails_to_post() {
        let lines = vec![
            JournalLine::new(AccountId(Uuid::new_v4()), Currency::SYP, Decimal::ONE,
                Money::syp(dec!(100)), Money::zero(), "مدين".to_string()),
            JournalLine::new(AccountId(Uuid::new_v4()), Currency::SYP, Decimal::ONE,
                Money::zero(), Money::syp(dec!(90)), "دائن".to_string()),
        ];
        let mut e = JournalEntry::new("JE-002".to_string(), lines, Utc::now(), "غير متوازن".to_string()).unwrap();
        assert!(e.post().is_err());
    }

    #[test]
    fn cannot_post_twice() {
        let mut e = JournalEntry::new(
            "JE-003".to_string(), balanced_lines(dec!(1000)),
            Utc::now(), "قيد".to_string(),
        ).unwrap();
        e.post().unwrap();
        assert!(e.post().is_err());
    }

    #[test]
    fn entry_without_lines_fails() {
        let r = JournalEntry::new("JE-EMPTY".to_string(), vec![], Utc::now(), "فارغ".to_string());
        assert!(r.is_err());
    }

    #[test]
    fn opening_stock_journal_entry_is_balanced() {
        let amount = dec!(150000);
        let mut e = JournalEntry::new(
            "JE-OP-001".to_string(), balanced_lines(amount),
            Utc::now(), "قيد بضاعة أول المدة".to_string(),
        ).unwrap();
        assert!(e.post().is_ok());
    }
}

