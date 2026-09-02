use crate::shared::errors::DomainError;
use crate::shared::ids::{MaterialCategoryId, MaterialId, MaterialUnitId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialUnit {
    pub id: MaterialUnitId,
    pub material_id: MaterialId,
    pub name: String,
    pub conversion_factor: rust_decimal::Decimal,
    pub barcode: Option<String>,
    pub is_base: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialPurchasePrice {
    pub id: String,
    pub unit_id: MaterialUnitId,
    pub price: rust_decimal::Decimal,
    pub price_base: rust_decimal::Decimal,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialSalePrice {
    pub id: String,
    pub unit_id: MaterialUnitId,
    pub tier: String,
    pub price: rust_decimal::Decimal,
    pub price_base: rust_decimal::Decimal,
    pub min_price: rust_decimal::Decimal,
    pub min_price_base: rust_decimal::Decimal,
    pub max_quantity: String,
    pub max_quantity_unit_id: Option<String>,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub id: MaterialId,
    pub name: String,
    pub name_en: String,
    pub barcode: String,
    pub code: String,
    pub minimum_stock: rust_decimal::Decimal,
    pub units: Vec<MaterialUnit>,
    pub category_ids: Vec<MaterialCategoryId>,
    pub notes: Option<String>,
    pub image_path: Option<String>,
    pub default_purchase_unit_id: Option<MaterialUnitId>,
    pub default_sale_unit_id: Option<MaterialUnitId>,
    pub default_purchase_currency: Option<String>,
    pub default_sale_currency: Option<String>,
    pub default_warehouse_id: Option<String>,
    pub has_expiry: bool,
    pub expiry_alert_before_days: i32,
    pub purchase_prices: Vec<MaterialPurchasePrice>,
    pub sale_prices: Vec<MaterialSalePrice>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Material {
    pub fn new(
        name: String,
        barcode: String,
        code: String,
        minimum_stock: rust_decimal::Decimal,
        unit_defs: Vec<(String, rust_decimal::Decimal, Option<String>)>,
        category_ids: Vec<MaterialCategoryId>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid(
                "اسم المادة لا يمكن أن يكون فارغًا".into(),
            ));
        }

        if code.trim().is_empty() && barcode.trim().is_empty() {
            return Err(DomainError::Invalid(
                "يجب إدخال إما الكود أو الباركود على الأقل".into(),
            ));
        }

        if unit_defs.is_empty() {
            return Err(DomainError::Invalid(
                "يجب إضافة وحدة قياس واحدة على الأقل".into(),
            ));
        }

        let now = Utc::now();
        let mid = MaterialId::new();

        let mut units = Vec::new();
        let mut found_base = false;

        for (u_name, u_factor, u_barcode) in unit_defs {
            let is_base = u_factor == rust_decimal::Decimal::from(1) && !found_base;
            if is_base {
                found_base = true;
            }

            units.push(MaterialUnit {
                id: MaterialUnitId::new(),
                material_id: mid,
                name: u_name,
                conversion_factor: u_factor,
                barcode: u_barcode,
                is_base,
            });
        }

        // If no unit has factor 1, the first one is forced to be base (though it should ideally have factor 1)
        if !found_base && !units.is_empty() {
            units[0].is_base = true;
            units[0].conversion_factor = rust_decimal::Decimal::from(1);
        }

        Ok(Self {
            id: mid,
            name,
            name_en: "".to_string(),
            barcode,
            code,
            minimum_stock,
            units,
            category_ids,
            notes: None,
            image_path: None,
            default_purchase_unit_id: None,
            default_sale_unit_id: None,
            default_purchase_currency: None,
            default_sale_currency: None,
            default_warehouse_id: None,
            has_expiry: false,
            expiry_alert_before_days: 0,
            purchase_prices: Vec::new(),
            sale_prices: Vec::new(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_categories(&mut self, category_ids: Vec<MaterialCategoryId>) {
        self.category_ids = category_ids;
        self.updated_at = Utc::now();
    }

    pub fn add_unit(
        &mut self,
        name: String,
        factor: rust_decimal::Decimal,
        barcode: Option<String>,
    ) {
        let unit = MaterialUnit {
            id: MaterialUnitId::new(),
            material_id: self.id,
            name,
            conversion_factor: factor,
            barcode,
            is_base: false,
        };
        self.units.push(unit);
        self.updated_at = Utc::now();
    }
}
