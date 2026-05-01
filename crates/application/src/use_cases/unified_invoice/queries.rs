use std::sync::Arc;
use std::str::FromStr;
use domain::sales::unified_invoice::{InvoiceType};
use domain::shared::ids::{InvoiceId, MaterialId, CustomerId, SupplierId};
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::category_repository::CategoryRepository;
use crate::dto::invoice_dto::{InvoiceDto};
use crate::errors::AppError;

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
        let invoice_id = InvoiceId::from_str(&id).map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?;
        let invoice = self.repo.find_by_id(&invoice_id).await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;
        
        let dto = InvoiceDto::from(invoice);
        self.populate_dto(dto).await
    }

    async fn populate_dto(&self, mut dto: InvoiceDto) -> Result<InvoiceDto, AppError> {
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
}
