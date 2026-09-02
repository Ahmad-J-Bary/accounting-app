use std::sync::Arc;

use crate::dto::barcode_dto::{BarcodeMatchDto, ResolveBarcodeRequest};
use crate::errors::AppError;
use crate::ports::material_repository::MaterialRepository;

pub struct ResolveBarcodeUseCase {
    material_repo: Arc<dyn MaterialRepository>,
}

impl ResolveBarcodeUseCase {
    pub fn new(material_repo: Arc<dyn MaterialRepository>) -> Self {
        Self { material_repo }
    }

    pub async fn execute(
        &self,
        request: ResolveBarcodeRequest,
    ) -> Result<BarcodeMatchDto, AppError> {
        let normalized = request.value.trim().replace(' ', "");
        if normalized.is_empty() {
            return Err(AppError::Invalid("قيمة الباركود فارغة".into()));
        }

        let material = self
            .material_repo
            .find_by_code_or_barcode(&normalized)
            .await?;
        if let Some(material) = material {
            let matched_unit_name = material
                .units
                .iter()
                .find(|unit| unit.barcode.as_deref() == Some(normalized.as_str()))
                .map(|unit| unit.name.clone());

            return Ok(BarcodeMatchDto {
                matched: true,
                normalized_value: normalized,
                material_id: Some(material.id.to_string()),
                material_code: Some(material.code),
                material_name: Some(material.name),
                matched_unit_name,
                source: request.source,
            });
        }

        Ok(BarcodeMatchDto {
            matched: false,
            normalized_value: normalized,
            material_id: None,
            material_code: None,
            material_name: None,
            matched_unit_name: None,
            source: request.source,
        })
    }
}
