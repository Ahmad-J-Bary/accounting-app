use crate::dto::invoice_dto::InvoiceDto;
use crate::errors::AppError;
use crate::ports::category_repository::CategoryRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use domain::sales::unified_invoice::InvoiceType;
use domain::shared::ids::{CustomerId, InvoiceId, MaterialId, SupplierId};
use rust_decimal::Decimal;
use std::str::FromStr;
use std::sync::Arc;

pub struct InvoiceQueries {
    repo: Arc<dyn UnifiedInvoiceRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    category_repo: Arc<dyn CategoryRepository>,
}

impl InvoiceQueries {
    pub fn new(
        repo: Arc<dyn UnifiedInvoiceRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        category_repo: Arc<dyn CategoryRepository>,
    ) -> Self {
        Self {
            repo,
            material_repo,
            customer_repo,
            supplier_repo,
            category_repo,
        }
    }

    pub async fn list_by_type(&self, invoice_type: String) -> Result<Vec<InvoiceDto>, AppError> {
        let itype = match invoice_type.as_str() {
            "Sales" => InvoiceType::Sales,
            "Purchase" => InvoiceType::Purchase,
            "OpeningBalance" => InvoiceType::OpeningBalance,
            _ => return Err(AppError::Invalid("نوع فاتورة غير صالح".into())),
        };

        let invoices = self.repo.list_by_type(itype).await?;
        let mut dtos = Vec::new();
        for inv in invoices {
            let dto = InvoiceDto::from(inv);
            dtos.push(self.populate_dto(dto).await?);
        }
        Ok(dtos)
    }

    pub async fn get_by_id(&self, id: String) -> Result<InvoiceDto, AppError> {
        let invoice_id = InvoiceId::from_str(&id)
            .map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?;
        let invoice = self
            .repo
            .find_by_id(&invoice_id)
            .await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;

        let dto = InvoiceDto::from(invoice);
        self.populate_dto(dto).await
    }

    pub async fn populate_dto(&self, mut dto: InvoiceDto) -> Result<InvoiceDto, AppError> {
        if let Some(ref cid) = dto.customer_id {
            if let Ok(id) = CustomerId::from_str(cid) {
                if let Ok(Some(customer)) = self.customer_repo.find_by_id(&id).await {
                    dto.customer_name = Some(customer.name);
                }
            }
        }
        if let Some(ref sid) = dto.supplier_id {
            if let Ok(id) = SupplierId::from_str(sid) {
                if let Ok(Some(supplier)) = self.supplier_repo.find_by_id(&id).await {
                    dto.supplier_name = Some(supplier.name);
                }
            }
        }

        for line in &mut dto.lines {
            if let Ok(mid) = MaterialId::from_str(&line.material_id) {
                if let Ok(Some(material)) = self.material_repo.find_by_id(&mid).await {
                    line.material_name = Some(material.name);
                    line.barcode = Some(material.barcode);
                    line.code = Some(material.code);
                    if let Some(cid) = material.category_ids.first() {
                        if let Ok(Some(cat)) = self.category_repo.find_by_id(cid).await {
                            line.category_name = Some(cat.name);
                        }
                    }
                }
            }
        }

        if dto.invoice_type == "Sales" {
            let mut total_profit = Decimal::ZERO;
            for line in &dto.lines {
                let q = Decimal::from_str(&line.quantity).unwrap_or(Decimal::ZERO);
                let sp = Decimal::from_str(&line.unit_price).unwrap_or(Decimal::ZERO);
                let cp = line
                    .purchase_price
                    .as_ref()
                    .and_then(|p| Decimal::from_str(p).ok())
                    .unwrap_or(Decimal::ZERO);
                total_profit += (sp - cp) * q;
            }
            let net = Decimal::from_str(&dto.total_amount).unwrap_or(Decimal::ZERO);
            dto.total_profit = Some(total_profit.to_string());
            if net > Decimal::ZERO {
                let percent = (total_profit / net) * Decimal::from(100);
                dto.profit_percent = Some(percent.round_dp(1).to_string());
            } else {
                dto.profit_percent = Some("0".to_string());
            }
        }

        Ok(dto)
    }

    pub async fn list_all(&self) -> Result<Vec<InvoiceDto>, AppError> {
        let invoices = self.repo.list_all().await?;
        let mut dtos = Vec::new();
        for inv in invoices {
            let dto = InvoiceDto::from(inv);
            dtos.push(self.populate_dto(dto).await?);
        }
        Ok(dtos)
    }

    pub async fn get_next_invoice_number(&self, invoice_type: String) -> Result<String, AppError> {
        let itype = match invoice_type.as_str() {
            "Sales" => InvoiceType::Sales,
            "Purchase" => InvoiceType::Purchase,
            "PurchaseCosts" => InvoiceType::PurchaseCosts,
            "OpeningBalance" => InvoiceType::OpeningBalance,
            _ => return Err(AppError::Invalid("Invalid invoice type".into())),
        };
        self.repo.get_next_invoice_number(itype).await
    }
}
