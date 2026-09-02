use crate::dto::material_dto::MaterialDto;
use crate::errors::AppError;
use crate::ports::inventory_lot_repository::InventoryLotRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use std::sync::Arc;

pub struct MaterialQueries {
    repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    invoice_repo: Arc<dyn UnifiedInvoiceRepository>,
    lot_repo: Option<Arc<dyn InventoryLotRepository>>,
}

impl MaterialQueries {
    pub fn new(
        repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        invoice_repo: Arc<dyn UnifiedInvoiceRepository>,
    ) -> Self {
        Self {
            repo,
            movement_repo,
            invoice_repo,
            lot_repo: None,
        }
    }

    pub fn with_lot_repo(mut self, lot_repo: Arc<dyn InventoryLotRepository>) -> Self {
        self.lot_repo = Some(lot_repo);
        self
    }

    async fn populate_lot_info(
        &self,
        dto: &mut MaterialDto,
        material_id: &str,
    ) -> Result<(), AppError> {
        if let Some(ref lot_repo) = self.lot_repo {
            dto.costing_method = lot_repo.get_costing_method(material_id).await?;
            dto.active_lots_count = lot_repo.count_active_by_material(material_id).await?;
        }
        Ok(())
    }

    pub async fn list_all(&self) -> Result<Vec<MaterialDto>, AppError> {
        let materials = self.repo.list_all().await?;
        let mut dtos = vec![];
        for m in materials {
            let mid = m.id;
            let mut dto = MaterialDto::from(m);
            let summary = self.movement_repo.get_material_summary(&mid).await?;
            dto.total_received = summary.total_received.to_string();
            dto.total_sold = summary.total_sold.to_string();
            dto.total_available = summary.total_available.to_string();
            dto.total_damaged = summary.total_damaged.to_string();
            dto.last_purchase_price = summary.last_purchase_price.to_string();
            dto.last_purchase_price_base = summary.last_purchase_price_base.to_string();
            dto.last_sale_price = summary.last_sale_price.to_string();
            dto.last_sale_price_base = summary.last_sale_price_base.to_string();
            dto.average_cost = summary.average_cost.to_string();
            dto.average_cost_base = summary.average_cost_base.to_string();
            dto.average_raw_price_base = summary.average_raw_price_base.to_string();

            let (last_p_orig, last_s_orig) = self
                .invoice_repo
                .get_last_original_prices(&mid.to_string())
                .await?;
            dto.last_purchase_price_original = last_p_orig;
            dto.last_sale_price_original = last_s_orig;

            self.populate_lot_info(&mut dto, &mid.to_string()).await?;

            dtos.push(dto);
        }
        Ok(dtos)
    }

    pub async fn get_by_id(&self, id: String) -> Result<MaterialDto, AppError> {
        let mid = id
            .parse()
            .map_err(|_| AppError::NotFound("معرف المادة غير صالح".into()))?;
        let material = self
            .repo
            .find_by_id(&mid)
            .await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let mut dto = MaterialDto::from(material);
        let summary = self.movement_repo.get_material_summary(&mid).await?;
        dto.total_received = summary.total_received.to_string();
        dto.total_sold = summary.total_sold.to_string();
        dto.total_available = summary.total_available.to_string();
        dto.total_damaged = summary.total_damaged.to_string();
        dto.last_purchase_price = summary.last_purchase_price.to_string();
        dto.last_purchase_price_base = summary.last_purchase_price_base.to_string();
        dto.last_sale_price = summary.last_sale_price.to_string();
        dto.last_sale_price_base = summary.last_sale_price_base.to_string();
        dto.average_cost = summary.average_cost.to_string();
        dto.average_cost_base = summary.average_cost_base.to_string();
        dto.average_raw_price_base = summary.average_raw_price_base.to_string();

        let (last_p_orig, last_s_orig) = self
            .invoice_repo
            .get_last_original_prices(&mid.to_string())
            .await?;
        dto.last_purchase_price_original = last_p_orig;
        dto.last_sale_price_original = last_s_orig;

        self.populate_lot_info(&mut dto, &mid.to_string()).await?;

        Ok(dto)
    }
}
