use super::helpers::enrich_payment;
use crate::dto::payment_dto::PaymentDto;
use crate::errors::AppError;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::payment_repository::PaymentRepository;
use crate::ports::supplier_repository::SupplierRepository;
use domain::shared::ids::{CustomerId, PaymentId, SupplierId};
use std::sync::Arc;

pub struct ListPaymentsUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
}

impl ListPaymentsUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
    ) -> Self {
        Self {
            repo,
            customer_repo,
            supplier_repo,
        }
    }

    pub async fn execute(
        &self,
        customer_id: Option<String>,
        supplier_id: Option<String>,
    ) -> Result<Vec<PaymentDto>, AppError> {
        let payments = if let Some(cid) = customer_id {
            let id = cid
                .parse::<CustomerId>()
                .map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))?;
            self.repo.list_by_customer(&id).await?
        } else if let Some(sid) = supplier_id {
            let id = sid
                .parse::<SupplierId>()
                .map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;
            self.repo.list_by_supplier(&id).await?
        } else {
            self.repo.list_all().await?
        };

        let mut dtos = Vec::new();
        for p in payments {
            dtos.push(enrich_payment(p, &self.customer_repo, &self.supplier_repo).await);
        }
        Ok(dtos)
    }
}

pub struct GetPaymentUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
}

impl GetPaymentUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
    ) -> Self {
        Self {
            repo,
            customer_repo,
            supplier_repo,
        }
    }

    pub async fn execute(&self, id: String) -> Result<PaymentDto, AppError> {
        let pid = id
            .parse::<PaymentId>()
            .map_err(|_| AppError::Invalid("معرف السند غير صالح".into()))?;

        let payment = self
            .repo
            .find_by_id(&pid)
            .await?
            .ok_or_else(|| AppError::NotFound("السند غير موجود".into()))?;

        Ok(enrich_payment(payment, &self.customer_repo, &self.supplier_repo).await)
    }
}
