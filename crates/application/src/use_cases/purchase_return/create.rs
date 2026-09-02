use crate::dto::returns_dto::{CreatePurchaseReturnRequest, PurchaseReturnDto};
use crate::errors::AppError;
use crate::ports::purchase_return_repository::PurchaseReturnRepository;
use crate::ports::supplier_repository::SupplierRepository;
use chrono::Utc;
use domain::returns::purchase_return::PurchaseReturnLine;
use domain::returns::PurchaseReturn;
use domain::shared::ids::{MaterialId, PurchaseReturnId, SupplierId};
use rust_decimal::Decimal;
use std::str::FromStr;
use std::sync::Arc;

pub struct CreatePurchaseReturnUseCase {
    repo: Arc<dyn PurchaseReturnRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
}

impl CreatePurchaseReturnUseCase {
    pub fn new(
        repo: Arc<dyn PurchaseReturnRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
    ) -> Self {
        Self {
            repo,
            supplier_repo,
        }
    }

    pub async fn execute(
        &self,
        req: CreatePurchaseReturnRequest,
    ) -> Result<PurchaseReturnDto, AppError> {
        let supplier_id = SupplierId::from_str(&req.supplier_id)
            .map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;

        let return_date = chrono::DateTime::parse_from_rfc3339(&req.return_date)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let return_number = if req.return_number.trim().is_empty() || req.return_number == "تلقائي"
        {
            self.repo.get_next_return_number().await?
        } else {
            req.return_number
        };

        let mut ret =
            PurchaseReturn::new(return_number.clone(), supplier_id, return_date, req.notes)
                .map_err(|e: domain::shared::errors::DomainError| {
                    AppError::Invalid(e.to_string())
                })?;

        // If editing (id provided), reuse existing ID
        if let Some(ref edit_id) = req.id {
            ret.id = PurchaseReturnId::from_str(edit_id)
                .map_err(|_| AppError::Invalid("معرف المرتجع غير صالح".into()))?;
        }

        for line_dto in req.lines {
            let material_id = MaterialId::from_str(&line_dto.material_id)
                .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
            let quantity = Decimal::from_str(&line_dto.quantity)
                .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
            let unit_price = Decimal::from_str(&line_dto.unit_price)
                .map_err(|_| AppError::Invalid("السعر غير صالح".into()))?;

            let line = PurchaseReturnLine::new(
                material_id,
                quantity,
                unit_price,
                line_dto.unit_id,
                line_dto.notes,
                line_dto.invoice_line_id,
            )
            .map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;
            ret.add_line(line)
                .map_err(|e: domain::shared::errors::DomainError| {
                    AppError::Invalid(e.to_string())
                })?;
        }

        self.repo.save(&ret).await?;

        let mut dto = PurchaseReturnDto::from(ret);
        if let Ok(id) = SupplierId::from_str(&dto.supplier_id) {
            if let Ok(Some(s)) = self.supplier_repo.find_by_id(&id).await {
                dto.supplier_name = Some(s.name);
            }
        }
        Ok(dto)
    }
}
