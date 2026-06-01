use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::returns::{SalesReturn};
use domain::returns::sales_return::SalesReturnLine;
use domain::shared::ids::{MaterialId, CustomerId};
use crate::ports::sales_return_repository::SalesReturnRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::dto::returns_dto::{CreateSalesReturnRequest, SalesReturnDto};
use crate::errors::AppError;

pub struct CreateSalesReturnUseCase {
    repo: Arc<dyn SalesReturnRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
}

impl CreateSalesReturnUseCase {
    pub fn new(
        repo: Arc<dyn SalesReturnRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        _material_repo: Arc<dyn MaterialRepository>,
    ) -> Self {
        Self { repo, customer_repo }
    }

    pub async fn execute(&self, req: CreateSalesReturnRequest) -> Result<SalesReturnDto, AppError> {
        let customer_id = CustomerId::from_str(&req.customer_id)
            .map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))?;

        let return_date = chrono::DateTime::parse_from_rfc3339(&req.return_date)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let return_number = if req.return_number.trim().is_empty() || req.return_number == "تلقائي" {
            self.repo.get_next_return_number().await?
        } else {
            req.return_number
        };

        let mut ret = SalesReturn::new(
            return_number,
            customer_id,
            return_date,
            req.notes,
        ).map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;

        for line_dto in req.lines {
            let material_id = MaterialId::from_str(&line_dto.material_id)
                .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
            let quantity = Decimal::from_str(&line_dto.quantity)
                .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
            let unit_price = Decimal::from_str(&line_dto.unit_price)
                .map_err(|_| AppError::Invalid("السعر غير صالح".into()))?;

            let line = SalesReturnLine::new(
                material_id,
                quantity,
                unit_price,
                line_dto.unit_id,
                line_dto.notes,
            ).map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;
            ret.add_line(line).map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;
        }

        self.repo.save(&ret).await?;
        let mut dto = SalesReturnDto::from(ret);
        if let Ok(id) = CustomerId::from_str(&dto.customer_id) {
            if let Ok(Some(c)) = self.customer_repo.find_by_id(&id).await {
                dto.customer_name = Some(c.name);
            }
        }
        Ok(dto)
    }
}
