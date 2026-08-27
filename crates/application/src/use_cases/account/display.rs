use domain::accounting::JournalType;

/// Canonical final Movement Type label for a General Ledger line. This is the
/// SINGLE source of truth for the type cell — the UI renders it verbatim and
/// never re-derives type labels from descriptions. When the effective type is
/// a manual General Journal, descriptions like "إهلاك سنوي" / "إضافة أصل سابق"
/// / "شراء أصل ثابت" refine the label into the fixed-asset subtype, mirroring
/// the behaviour that used to live (brittly) in the React table.
pub fn derive_journal_type_display(
    effective_type: JournalType,
    description: &str,
    opposite_account_name: &str,
    view_account_name: &str,
) -> String {
    if effective_type != JournalType::GeneralJournal {
        return effective_type.to_string();
    }

    let is_depreciation = description.contains("إهلاك سنوي") || description.contains("إهلاك");
    let is_opening = description.contains("إضافة أصل سابق") || description.contains("أول المدة");
    let is_purchase = description.contains("شراء أصل ثابت") || description.contains("اثبات شراء");

    if !(is_depreciation || is_opening || is_purchase) {
        return JournalType::GeneralJournal.to_string();
    }

    let names = [opposite_account_name, view_account_name];
    let asset_type = if names.iter().any(|s| {
        s.contains("أبنية")
            || s.contains("أراضي")
            || s.contains("المباني")
            || s.contains("الأراضي")
    }) {
        "أبنية وأراضي"
    } else if names.iter().any(|s| {
        s.contains("آليات")
            || s.contains("سيارات")
            || s.contains("مركبات")
            || s.contains("السيارات")
            || s.contains("الآليات")
    }) {
        "آليات ومركبات"
    } else if names.iter().any(|s| {
        s.contains("معدات")
            || s.contains("تجهيزات")
            || s.contains("الآلات")
            || s.contains("المعدات")
    }) {
        "معدات وتجهيزات"
    } else if names.iter().any(|s| {
        s.contains("أثاث") || s.contains("مفروشات") || s.contains("المفروشات")
    }) {
        "أثاث ومفروشات"
    } else {
        "أصول ثابتة"
    };

    if is_depreciation {
        "إهلاك سنوي".to_string()
    } else if is_opening {
        format!("رصيد افتتاحي للأصول الثابتة / {asset_type}")
    } else {
        format!("شراء أصل ثابت / {asset_type}")
    }
}

/// Whether a ledger line establishes an opening balance: a posted opening
/// journal type OR a manual General Journal whose description marks it as an
/// opening (legacy users recorded openings via General Journal). The backend
/// computes this once so the UI never classifies by string matching.
pub fn is_opening_line(journal_type: JournalType, description: &str) -> bool {
    matches!(
        journal_type,
        JournalType::AccountOpeningBalance
            | JournalType::CashOpeningBalance
            | JournalType::MaterialOpeningBalance
    ) || description.contains("رصيد افتتاحي")
        || description.contains("أول المدة")
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::accounting::JournalType;

    #[test]
    fn opening_types_are_opening_lines() {
        for t in [
            JournalType::AccountOpeningBalance,
            JournalType::CashOpeningBalance,
            JournalType::MaterialOpeningBalance,
        ] {
            assert!(is_opening_line(t, ""));
        }
    }

    #[test]
    fn manual_general_journal_opening_by_description() {
        assert!(is_opening_line(
            JournalType::GeneralJournal,
            "إثبات رصيد افتتاحي للمورد"
        ));
        assert!(is_opening_line(JournalType::GeneralJournal, "مواد أول المدة"));
        assert!(!is_opening_line(JournalType::GeneralJournal, "فاتورة بيع"));
        assert!(!is_opening_line(JournalType::CashReceipt, "سند قبض عادي"));
    }

    #[test]
    fn non_fixed_asset_general_journal_stays_general() {
        assert_eq!(
            derive_journal_type_display(
                JournalType::GeneralJournal,
                "سداد مستحقات مورد",
                "-",
                "الصندوق",
            ),
            "اليومية العامة"
        );
    }

    #[test]
    fn fixed_asset_depreciation_label() {
        assert_eq!(
            derive_journal_type_display(
                JournalType::GeneralJournal,
                "قيد الإهلاك السنوي للمعدات",
                "معدات وتجهيزات",
                "-",
            ),
            "إهلاك سنوي"
        );
    }

    #[test]
    fn fixed_asset_opening_and_purchase_labels() {
        assert_eq!(
            derive_journal_type_display(
                JournalType::GeneralJournal,
                "إضافة أصل سابق",
                "أبنية وأراضي",
                "-",
            ),
            "رصيد افتتاحي للأصول الثابتة / أبنية وأراضي"
        );
        assert_eq!(
            derive_journal_type_display(
                JournalType::GeneralJournal,
                "اثبات شراء أصل ثابت",
                "أثاث ومفروشات",
                "-",
            ),
            "شراء أصل ثابت / أثاث ومفروشات"
        );
    }

    #[test]
    fn view_account_name_refines_asset_type() {
        assert_eq!(
            derive_journal_type_display(
                JournalType::GeneralJournal,
                "إضافة أصل سابق",
                "-",
                "معدات وتجهيزات",
            ),
            "رصيد افتتاحي للأصول الثابتة / معدات وتجهيزات"
        );
    }

    #[test]
    fn non_general_types_pass_through() {
        assert_eq!(
            derive_journal_type_display(JournalType::AccountOpeningBalance, "anything", "-", "-"),
            "رصيد افتتاحي"
        );
        assert_eq!(
            derive_journal_type_display(JournalType::CashReceipt, "anything", "-", "-"),
            "سند قبض"
        );
        assert_eq!(
            derive_journal_type_display(JournalType::DiscountGrantedJournal, "anything", "-", "-"),
            "حسم ممنوح"
        );
    }
}
