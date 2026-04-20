use std::sync::Arc;
use std::str::FromStr;
use uuid::Uuid;

use domain::sales::{Invoice, InvoiceLine};
use domain::shared::{CustomerId, ProductId, Money};
use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto};

pub struct CreateInvoiceUseCase {
    repo: Arc<dyn InvoiceRepository>,
}

impl CreateInvoiceUseCase {
    pub fn new(repo: Arc<dyn InvoiceRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, request: CreateInvoiceRequest) -> Result<InvoiceDto, AppError> {
        let customer_id = CustomerId(
            Uuid::parse_str(&request.customer_id)
                .map_err(|e| AppError::Invalid(format!("Invalid customer ID: {}", e)))?
        );

        let lines: Result<Vec<InvoiceLine>, AppError> = request.lines
            .into_iter()
            .map(|dto| {
                let product_id = ProductId(
                    Uuid::parse_str(&dto.product_id)
                        .map_err(|e| AppError::Invalid(format!("Invalid product ID: {}", e)))?
                );
                let quantity = rust_decimal::Decimal::from_str(&dto.quantity)
                    .map_err(|e| AppError::Invalid(format!("Invalid quantity: {}", e)))?;
                let unit_price = Money::new(
                    rust_decimal::Decimal::from_str(&dto.unit_price)
                        .map_err(|e| AppError::Invalid(format!("Invalid unit price: {}", e)))?
                );
                Ok(InvoiceLine::new(product_id, quantity, unit_price))
            })
            .collect();

        let lines = lines?;

        let invoice = Invoice::new(customer_id, lines)
            .map_err(AppError::from)?;

        self.repo.save(&invoice).await?;

        Ok(InvoiceDto::from(invoice))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Mutex;
    use domain::sales::invoice_line::InvoiceLine as DomainInvoiceLine;
    use domain::shared::Money as DomainMoney;
    use rust_decimal_macros::dec;

    struct MockInvoiceRepository {
        saved: Mutex<Vec<Invoice>>,
    }

    #[async_trait]
    impl InvoiceRepository for MockInvoiceRepository {
        async fn save(&self, invoice: &Invoice) -> Result<(), AppError> {
            self.saved.lock().unwrap().push(invoice.clone());
            Ok(())
        }

        async fn find_by_id(&self, _: &domain::shared::InvoiceId) -> Result<Option<Invoice>, AppError> {
            Ok(None)
        }

        async fn list_for_customer(&self, _: uuid::Uuid) -> Result<Vec<Invoice>, AppError> {
            Ok(vec![])
        }

        async fn list_all(&self) -> Result<Vec<Invoice>, AppError> {
            Ok(vec![])
        }

        async fn delete(&self, _: &core_domain::shared::InvoiceId) -> Result<(), AppError> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn creates_and_saves_invoice() {
        let repo = Arc::new(MockInvoiceRepository { saved: Mutex::new(vec![]) });
        let uc = CreateInvoiceUseCase::new(repo.clone());

        let request = CreateInvoiceRequest {
            customer_id: Uuid::new_v4().to_string(),
            lines: vec![
                InvoiceLineDto {
                    product_id: Uuid::new_v4().to_string(),
                    quantity: "2".to_string(),
                    unit_price: "50".to_string(),
                },
            ],
        };

        let result = uc.execute(request).await;
        assert!(result.is_ok());
        assert_eq!(repo.saved.lock().unwrap().len(), 1);
    }
}
