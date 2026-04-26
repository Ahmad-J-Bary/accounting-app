// ============================================================
// Domain Tests — Arabic ERP System
// Uses crate:: paths since tests live inside the domain crate
// ============================================================

#[cfg(test)]
mod product_domain_tests {
    use crate::inventory::product::Product;
    use crate::shared::money::Money;
    use rust_decimal_macros::dec;
    use rust_decimal::Decimal;

    fn make_product(name: &str, code: &str) -> Product {
        Product::new(
            name.to_string(), None, code.to_string(),
            None, None, None, None, dec!(5),
        ).unwrap()
    }

    #[test]
    fn new_product_starts_with_zero_stock() {
        let p = make_product("بضاعة اختبار", "TEST-001");
        assert_eq!(p.stock_quantity, Decimal::ZERO);
    }

    #[test]
    fn product_with_empty_name_fails() {
        let r = Product::new("".to_string(), None, "CODE".to_string(), None, None, None, None, dec!(0));
        assert!(r.is_err());
    }

    #[test]
    fn product_with_empty_code_fails() {
        let r = Product::new("اسم".to_string(), None, "".to_string(), None, None, None, None, dec!(0));
        assert!(r.is_err());
    }

    #[test]
    fn adjust_stock_increases_quantity() {
        let mut p = make_product("بضاعة", "P001");
        p.adjust_stock(dec!(100)).unwrap();
        assert_eq!(p.stock_quantity, dec!(100));
    }

    #[test]
    fn adjust_stock_decreases_quantity() {
        let mut p = make_product("بضاعة", "P002");
        p.adjust_stock(dec!(50)).unwrap();
        p.adjust_stock(dec!(-20)).unwrap();
        assert_eq!(p.stock_quantity, dec!(30));
    }

    #[test]
    fn adjust_stock_below_zero_is_rejected() {
        let mut p = make_product("بضاعة", "P003");
        p.adjust_stock(dec!(10)).unwrap();
        let r = p.adjust_stock(dec!(-50));
        assert!(r.is_err(), "لا يجب السماح بمخزون سالب");
    }

    #[test]
    fn product_prices_are_optional() {
        let p = Product::new(
            "مادة بدون أسعار".to_string(), None, "NO-PRICE".to_string(),
            None, None, None, None, dec!(0),
        ).unwrap();
        assert!(p.purchase_price.is_none());
        assert!(p.retail_price.is_none());
    }

    #[test]
    fn profit_margin_is_zero_when_prices_not_set() {
        let p = make_product("مادة", "P004");
        assert_eq!(p.profit_margin(), Decimal::ZERO);
    }

    #[test]
    fn profit_margin_calculates_correctly() {
        let p = Product::new(
            "منتج".to_string(), None, "P005".to_string(),
            Some(Money::syp(dec!(700))),
            Some(Money::syp(dec!(1000))),
            None, None, dec!(0),
        ).unwrap();
        // (1000 - 700) / 1000 = 0.30
        assert_eq!(p.profit_margin(), dec!(0.30));
    }

    #[test]
    fn is_below_minimum_stock_works() {
        let mut p = Product::new(
            "بضاعة".to_string(), None, "P006".to_string(),
            None, None, None, None, dec!(10),
        ).unwrap();
        assert!(p.is_below_minimum_stock()); // stock=0, min=10
        p.adjust_stock(dec!(15)).unwrap();
        assert!(!p.is_below_minimum_stock()); // stock=15, min=10
    }

    #[test]
    fn deactivate_and_activate_product() {
        let mut p = make_product("مادة", "P007");
        assert!(p.is_active);
        p.deactivate();
        assert!(!p.is_active);
        p.activate();
        assert!(p.is_active);
    }
}

#[cfg(test)]
mod stock_movement_domain_tests {
    use crate::inventory::stock_movement::{StockMovement, MovementType};
    use crate::shared::ids::MaterialId;
    use uuid::Uuid;
    use rust_decimal_macros::dec;
    use chrono::Utc;

    fn mv(t: MovementType, qty: rust_decimal::Decimal) -> StockMovement {
        StockMovement::new(
            MaterialId(Uuid::new_v4()), t, qty,
            "REF-001".to_string(), "ملاحظات".to_string(), Utc::now(),
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
            MaterialId(Uuid::new_v4()), MovementType::In, dec!(0),
            "REF".to_string(), "".to_string(), Utc::now(),
        );
        assert!(r.is_err(), "الكمية صفر يجب أن ترفض");
    }

    #[test]
    fn negative_quantity_movement_fails() {
        let r = StockMovement::new(
            MaterialId(Uuid::new_v4()), MovementType::Out, dec!(-10),
            "REF".to_string(), "".to_string(), Utc::now(),
        );
        assert!(r.is_err(), "الكمية السالبة يجب أن ترفض");
    }

    #[test]
    fn empty_reference_movement_fails() {
        let r = StockMovement::new(
            MaterialId(Uuid::new_v4()), MovementType::In, dec!(10),
            "".to_string(), "".to_string(), Utc::now(),
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

