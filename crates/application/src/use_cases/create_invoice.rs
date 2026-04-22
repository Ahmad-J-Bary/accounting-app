use std::sync::Arc;
use uuid::Uuid;

use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::product_repository::ProductRepository;
use crate::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto};
use domain::sales::{Invoice, InvoiceLine};
use domain::shared::ids::{CustomerId, ProductId};
use rust_decimal::Decimal;
use std::str::FromStr;

pub struct CreateInvoiceUseCase {
    repo: Arc<dyn InvoiceRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    product_repo: Arc<dyn ProductRepository>,
}

impl CreateInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn InvoiceRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        product_repo: Arc<dyn ProductRepository>,
    ) -> Self {
        Self { repo, customer_repo, product_repo }
    }

    pub async fn execute(&self, request: CreateInvoiceRequest) -> Result<InvoiceDto, AppError> {
        let customer_id = Uuid::parse_str(&request.customer_id)
            .map_err(|e| AppError::Invalid(format!("Invalid customer ID: {}", e)))?;
        
        let mut lines = Vec::new();
        for line_dto in request.lines {
            let product_id = Uuid::parse_str(&line_dto.product_id)
                .map_err(|e| AppError::Invalid(format!("Invalid product ID: {}", e)))?;
            let quantity = Decimal::from_str(&line_dto.quantity)
                .map_err(|e| AppError::Invalid(format!("Invalid quantity: {}", e)))?;
            let unit_price = Decimal::from_str(&line_dto.unit_price)
                .map_err(|e| AppError::Invalid(format!("Invalid unit price: {}", e)))?;
            
            lines.push(InvoiceLine::new(
                ProductId(product_id),
                quantity,
                unit_price.into(),
            ));
        }

        let tax_amount = Decimal::from_str(&request.tax_amount)
            .map_err(|e| AppError::Invalid(format!("Invalid tax amount: {}", e)))?;
        let discount_amount = Decimal::from_str(&request.discount_amount)
            .map_err(|e| AppError::Invalid(format!("Invalid discount amount: {}", e)))?;

        let invoice = Invoice::new(
            request.invoice_number,
            CustomerId(customer_id),
            lines,
            tax_amount.into(),
            discount_amount.into(),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.repo.save(&invoice).await?;
        
        let mut dto = InvoiceDto::from(invoice);
        
        // Enrich with customer name
        if let Ok(Some(customer)) = self.customer_repo.find_by_id(&CustomerId(customer_id)).await {
            dto.customer_name = Some(customer.name);
        }
        
        // Enrich with product names
        for line in &mut dto.lines {
            if let Ok(pid) = Uuid::parse_str(&line.product_id) {
                if let Ok(Some(product)) = self.product_repo.find_by_id(&ProductId(pid)).await {
                    line.product_name = Some(product.name);
                }
            }
        }

        Ok(dto)
    }
}
