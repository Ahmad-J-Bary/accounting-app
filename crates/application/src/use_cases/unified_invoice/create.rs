use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType};
use domain::sales::invoice_line::InvoiceLine;
use domain::shared::ids::{MaterialId, CustomerId, SupplierId};
use domain::shared::money::Money;
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use crate::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto};
use crate::errors::AppError;

pub struct CreateInvoiceUseCase {
    repo: Arc<dyn UnifiedInvoiceRepository>,
}

impl CreateInvoiceUseCase {
    pub fn new(repo: Arc<dyn UnifiedInvoiceRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateInvoiceRequest) -> Result<InvoiceDto, AppError> {
        let invoice_type = match req.invoice_type.as_str() {
            "Sales" => InvoiceType::Sales,
            "Purchase" => InvoiceType::Purchase,
            "OpeningBalance" => InvoiceType::OpeningBalance,
            _ => return Err(AppError::Invalid("نوع فاتورة غير صالح".into())),
        };

        let customer_id = req.customer_id.map(|id| CustomerId::from_str(&id).unwrap());
        let supplier_id = req.supplier_id.map(|id| SupplierId::from_str(&id).unwrap());
        let issued_at = chrono::DateTime::parse_from_rfc3339(&req.issued_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let mut invoice = UnifiedInvoice::new(
            req.invoice_number,
            invoice_type,
            customer_id,
            supplier_id,
            issued_at,
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        for line_dto in req.lines {
            let material_id = MaterialId::from_str(&line_dto.material_id)
                .map_err(|_| AppError::Invalid("معرف مادة غير صالح".into()))?;
            
            let quantity = Decimal::from_str(&line_dto.quantity)
                .map_err(|_| AppError::Invalid("كمية غير صالحة".into()))?;
            
            let unit_price = Money::syp(Decimal::from_str(&line_dto.unit_price)
                .map_err(|_| AppError::Invalid("سعر غير صالح".into()))?);

            let purchase_price = line_dto.purchase_price.and_then(|s| Decimal::from_str(&s).ok().map(Money::syp));
            let retail_price = line_dto.retail_price.and_then(|s| Decimal::from_str(&s).ok().map(Money::syp));
            let wholesale_price = line_dto.wholesale_price.and_then(|s| Decimal::from_str(&s).ok().map(Money::syp));
            let semi_wholesale_price = line_dto.semi_wholesale_price.and_then(|s| Decimal::from_str(&s).ok().map(Money::syp));
            let minimum_stock = line_dto.minimum_stock.and_then(|s| Decimal::from_str(&s).ok());

            let line = InvoiceLine::new(
                material_id,
                quantity,
                unit_price,
                purchase_price,
                retail_price,
                wholesale_price,
                semi_wholesale_price,
                minimum_stock,
                line_dto.notes,
            );
            invoice.add_line(line).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        invoice.tax_amount = Money::syp(Decimal::from_str(&req.tax_amount).unwrap_or(Decimal::ZERO));
        invoice.discount_amount = Money::syp(Decimal::from_str(&req.discount_amount).unwrap_or(Decimal::ZERO));
        invoice.recalculate_totals();

        self.repo.save(&invoice).await?;
        Ok(InvoiceDto::from(invoice))
    }
}
