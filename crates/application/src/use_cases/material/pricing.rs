use crate::dto::material_dto::{
    CreateMaterialPriceRequest,
    CreateMaterialSalePriceRequest,
};
use crate::errors::AppError;
use domain::inventory::material::{
    MaterialPurchasePrice,
    MaterialSalePrice,
    MaterialUnit,
};
use domain::shared::ids::MaterialUnitId;
use uuid::Uuid;

fn normalize_key(value: &str) -> String {
    value.trim().to_string()
}

fn resolve_unit_id(raw_unit_id: &str, units: &[MaterialUnit]) -> Result<MaterialUnitId, AppError> {
    let normalized = raw_unit_id.trim();
    if normalized.is_empty() {
        return Err(AppError::Invalid("معرف وحدة غير صالح".into()));
    }

    if let Some(unit) = units.iter().find(|unit| unit.name == normalized) {
        return Ok(unit.id);
    }

    let parsed = normalized
        .parse()
        .map_err(|_| AppError::Invalid("معرف وحدة غير صالح".into()))?;

    if units.iter().any(|unit| unit.id == parsed) {
        return Ok(parsed);
    }

    Err(AppError::Invalid("وحدة غير موجودة في قائمة الوحدات".into()))
}

pub fn resolve_default_unit_id(
    raw_unit_id: Option<String>,
    units: &[MaterialUnit],
) -> Result<Option<MaterialUnitId>, AppError> {
    match raw_unit_id {
        Some(value) if !value.trim().is_empty() => Ok(Some(resolve_unit_id(&value, units)?)),
        _ => Ok(None),
    }
}

pub fn build_purchase_prices(
    requests: Vec<CreateMaterialPriceRequest>,
    units: &[MaterialUnit],
) -> Result<Vec<MaterialPurchasePrice>, AppError> {
    let mut deduped: Vec<CreateMaterialPriceRequest> = Vec::new();

    for request in requests {
        let key = format!(
            "{}::{}",
            normalize_key(&request.unit_id),
            normalize_key(&request.currency),
        );

        if let Some(existing) = deduped.iter_mut().find(|item| {
            format!(
                "{}::{}",
                normalize_key(&item.unit_id),
                normalize_key(&item.currency),
            ) == key
        }) {
            *existing = request;
        } else {
            deduped.push(request);
        }
    }

    deduped
        .into_iter()
        .map(|request| {
            Ok(MaterialPurchasePrice {
                id: Uuid::new_v4().to_string(),
                unit_id: resolve_unit_id(&request.unit_id, units)?,
                price: request.price.parse().unwrap_or_default(),
                price_base: request.price_base.parse().unwrap_or_default(),
                currency: request.currency,
            })
        })
        .collect()
}

pub fn build_sale_prices(
    requests: Vec<CreateMaterialSalePriceRequest>,
    units: &[MaterialUnit],
) -> Result<Vec<MaterialSalePrice>, AppError> {
    let mut deduped: Vec<CreateMaterialSalePriceRequest> = Vec::new();

    for request in requests {
        let key = format!(
            "{}::{}::{}",
            normalize_key(&request.unit_id),
            normalize_key(&request.tier),
            normalize_key(&request.currency),
        );

        if let Some(existing) = deduped.iter_mut().find(|item| {
            format!(
                "{}::{}::{}",
                normalize_key(&item.unit_id),
                normalize_key(&item.tier),
                normalize_key(&item.currency),
            ) == key
        }) {
            *existing = request;
        } else {
            deduped.push(request);
        }
    }

    deduped
        .into_iter()
        .map(|request| {
            Ok(MaterialSalePrice {
                id: Uuid::new_v4().to_string(),
                unit_id: resolve_unit_id(&request.unit_id, units)?,
                tier: request.tier,
                price: request.price.parse().unwrap_or_default(),
                price_base: request.price_base.parse().unwrap_or_default(),
                min_price: request.min_price.parse().unwrap_or_default(),
                min_price_base: request.min_price_base.parse().unwrap_or_default(),
                currency: request.currency,
            })
        })
        .collect()
}
