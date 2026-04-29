use std::sync::Arc;
use uuid::Uuid;

use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto};
use domain::sales::{Invoice, InvoiceLine};
use domain::shared::ids::{CustomerId, MaterialId};
use rust_decimal::Decimal;
use std::str::FromStr;

pub struct CreateInvoiceUseCase {
    repo: Arc<dyn InvoiceRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl CreateInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn InvoiceRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        material_repo: Arc<dyn MaterialRepository>,
    ) -> Self {
        Self { repo, customer_repo, material_repo }
    }

    pub async fn execute(&self, request: CreateInvoiceRequest) -> Result<InvoiceDto, AppError> {
        let customer_id = request.customer_id.parse::<CustomerId>()
            .map_err(|e| AppError::Invalid(format!("Invalid customer ID: {}", e)))?;
        
        let mut lines = Vec::new();
        for line_dto in request.lines {
            let material_id = line_dto.material_id.parse::<MaterialId>()
                .map_err(|e| AppError::Invalid(format!("Invalid material ID: {}", e)))?;
            let quantity = crate::utils::parse_decimal(Some(&line_dto.quantity), "الكمية")?;
            let unit_price = crate::utils::parse_decimal(Some(&line_dto.unit_price), "سعر الوحدة")?;
            
            lines.push(InvoiceLine::new(
                material_id,
                quantity,
                domain::shared::money::Money::syp(unit_price),
            ));
        }

        let tax_amount = crate::utils::parse_decimal(Some(&request.tax_amount), "قيمة الضريبة")?;
        let discount_amount = crate::utils::parse_decimal(Some(&request.discount_amount), "قيمة الخصم")?;

        let invoice = Invoice::new(
            request.invoice_number,
            customer_id,
            lines,
            domain::shared::money::Money::syp(tax_amount),
            domain::shared::money::Money::syp(discount_amount),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.repo.save(&invoice).await?;
        
        let mut dto = InvoiceDto::from(invoice);
        
        // Enrich with customer name
        if let Ok(Some(customer)) = self.customer_repo.find_by_id(&customer_id).await {
            dto.customer_name = Some(customer.name);
        }
        
        // Enrich with material names
        for line in &mut dto.lines {
            if let Ok(mid) = line.material_id.parse::<MaterialId>() {
                if let Ok(Some(material)) = self.material_repo.find_by_id(&mid).await {
                    line.material_name = Some(material.name);
                }
            }
        }

        Ok(dto)
    }
}
