use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldCurrency {
    pub code: String,
    pub name_ar: String,
    pub name_en: String,
    pub symbol: String,
    pub decimals: i32,
}

pub fn get_world_currencies() -> Vec<WorldCurrency> {
    vec![
        WorldCurrency { code: "USD".into(), name_ar: "دولار أمريكي".into(), name_en: "US Dollar".into(), symbol: "$".into(), decimals: 2 },
        WorldCurrency { code: "EUR".into(), name_ar: "يورو".into(), name_en: "Euro".into(), symbol: "€".into(), decimals: 2 },
        WorldCurrency { code: "GBP".into(), name_ar: "جنيه إسترليني".into(), name_en: "British Pound".into(), symbol: "£".into(), decimals: 2 },
        WorldCurrency { code: "TRY".into(), name_ar: "ليرة تركية".into(), name_en: "Turkish Lira".into(), symbol: "₺".into(), decimals: 2 },
        WorldCurrency { code: "SAR".into(), name_ar: "ريال سعودي".into(), name_en: "Saudi Riyal".into(), symbol: "﷼".into(), decimals: 2 },
        WorldCurrency { code: "AED".into(), name_ar: "درهم إماراتي".into(), name_en: "UAE Dirham".into(), symbol: "د.إ".into(), decimals: 2 },
        WorldCurrency { code: "QAR".into(), name_ar: "ريال قطري".into(), name_en: "Qatari Riyal".into(), symbol: "﷼".into(), decimals: 2 },
        WorldCurrency { code: "KWD".into(), name_ar: "دينار كويتي".into(), name_en: "Kuwaiti Dinar".into(), symbol: "د.ك".into(), decimals: 3 },
        WorldCurrency { code: "BHD".into(), name_ar: "دينار بحريني".into(), name_en: "Bahraini Dinar".into(), symbol: "د.ب".into(), decimals: 3 },
        WorldCurrency { code: "OMR".into(), name_ar: "ريال عماني".into(), name_en: "Omani Rial".into(), symbol: "﷼".into(), decimals: 3 },
        WorldCurrency { code: "JOD".into(), name_ar: "دينار أردني".into(), name_en: "Jordanian Dinar".into(), symbol: "د.ا".into(), decimals: 3 },
        WorldCurrency { code: "EGP".into(), name_ar: "جنيه مصري".into(), name_en: "Egyptian Pound".into(), symbol: "ج.م".into(), decimals: 2 },
        WorldCurrency { code: "MAD".into(), name_ar: "درهم مغربي".into(), name_en: "Moroccan Dirham".into(), symbol: "د.م".into(), decimals: 2 },
        WorldCurrency { code: "DZD".into(), name_ar: "دينار جزائري".into(), name_en: "Algerian Dinar".into(), symbol: "د.ج".into(), decimals: 2 },
        WorldCurrency { code: "TND".into(), name_ar: "دينار تونسي".into(), name_en: "Tunisian Dinar".into(), symbol: "د.ت".into(), decimals: 3 },
        WorldCurrency { code: "LYD".into(), name_ar: "دينار ليبي".into(), name_en: "Libyan Dinar".into(), symbol: "د.ل".into(), decimals: 3 },
        WorldCurrency { code: "SDG".into(), name_ar: "جنيه سوداني".into(), name_en: "Sudanese Pound".into(), symbol: "ج.س".into(), decimals: 2 },
        WorldCurrency { code: "IQD".into(), name_ar: "دينار عراقي".into(), name_en: "Iraqi Dinar".into(), symbol: "د.ع".into(), decimals: 3 },
        WorldCurrency { code: "SYP".into(), name_ar: "ليرة سورية".into(), name_en: "Syrian Pound".into(), symbol: "ل.س".into(), decimals: 2 },
        WorldCurrency { code: "LBP".into(), name_ar: "ليرة لبنانية".into(), name_en: "Lebanese Pound".into(), symbol: "ل.ل".into(), decimals: 2 },
        WorldCurrency { code: "YER".into(), name_ar: "ريال يمني".into(), name_en: "Yemeni Rial".into(), symbol: "﷼".into(), decimals: 2 },
        WorldCurrency { code: "CNY".into(), name_ar: "يوان صيني".into(), name_en: "Chinese Yuan".into(), symbol: "¥".into(), decimals: 2 },
        WorldCurrency { code: "JPY".into(), name_ar: "ين ياباني".into(), name_en: "Japanese Yen".into(), symbol: "¥".into(), decimals: 0 },
        WorldCurrency { code: "INR".into(), name_ar: "روبية هندية".into(), name_en: "Indian Rupee".into(), symbol: "₹".into(), decimals: 2 },
        WorldCurrency { code: "PKR".into(), name_ar: "روبية باكستانية".into(), name_en: "Pakistani Rupee".into(), symbol: "₨".into(), decimals: 2 },
        WorldCurrency { code: "CHF".into(), name_ar: "فرنك سويسري".into(), name_en: "Swiss Franc".into(), symbol: "Fr".into(), decimals: 2 },
        WorldCurrency { code: "CAD".into(), name_ar: "دولار كندي".into(), name_en: "Canadian Dollar".into(), symbol: "C$".into(), decimals: 2 },
        WorldCurrency { code: "AUD".into(), name_ar: "دولار أسترالي".into(), name_en: "Australian Dollar".into(), symbol: "A$".into(), decimals: 2 },
        WorldCurrency { code: "SEK".into(), name_ar: "كرونا سويدية".into(), name_en: "Swedish Krona".into(), symbol: "kr".into(), decimals: 2 },
        WorldCurrency { code: "NOK".into(), name_ar: "كرونا نرويجية".into(), name_en: "Norwegian Krone".into(), symbol: "kr".into(), decimals: 2 },
        WorldCurrency { code: "DKK".into(), name_ar: "كرونا دنماركية".into(), name_en: "Danish Krone".into(), symbol: "kr".into(), decimals: 2 },
        WorldCurrency { code: "PLN".into(), name_ar: "زلوتي بولندي".into(), name_en: "Polish Zloty".into(), symbol: "zł".into(), decimals: 2 },
        WorldCurrency { code: "RUB".into(), name_ar: "روبل روسي".into(), name_en: "Russian Ruble".into(), symbol: "₽".into(), decimals: 2 },
        WorldCurrency { code: "BRL".into(), name_ar: "ريال برازيلي".into(), name_en: "Brazilian Real".into(), symbol: "R$".into(), decimals: 2 },
        WorldCurrency { code: "ZAR".into(), name_ar: "راند جنوب أفريقي".into(), name_en: "South African Rand".into(), symbol: "R".into(), decimals: 2 },
        WorldCurrency { code: "MYR".into(), name_ar: "رينغيت ماليزي".into(), name_en: "Malaysian Ringgit".into(), symbol: "RM".into(), decimals: 2 },
        WorldCurrency { code: "SGD".into(), name_ar: "دولار سنغافوري".into(), name_en: "Singapore Dollar".into(), symbol: "S$".into(), decimals: 2 },
        WorldCurrency { code: "HKD".into(), name_ar: "دولار هونغ كونغ".into(), name_en: "Hong Kong Dollar".into(), symbol: "HK$".into(), decimals: 2 },
    ]
}
