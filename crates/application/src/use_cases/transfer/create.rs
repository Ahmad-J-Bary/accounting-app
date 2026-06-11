use std::collections::HashSet;
use std::str::FromStr;
use std::sync::Arc;
use crate::dto::transfer_dto::{CreateTransferRequest, TransferResponse};
use crate::errors::AppError;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::warehouse_repository::WarehouseRepository;
use chrono::{DateTime, Utc};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::shared::ids::{MaterialId, WarehouseId};
use rust_decimal::Decimal;

pub struct CreateTransferUseCase {
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
}

impl CreateTransferUseCase {
    pub fn new(
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        warehouse_repo: Arc<dyn WarehouseRepository>,
    ) -> Self {
        Self { material_repo, movement_repo, warehouse_repo }
    }

    pub async fn execute(&self, req: CreateTransferRequest) -> Result<TransferResponse, AppError> {
        if req.source_warehouse_id == req.dest_warehouse_id {
            return Err(AppError::Invalid("لا يمكن التحويل إلى نفس المستودع".into()));
        }

        let source_wh_id = req.source_warehouse_id.parse::<WarehouseId>()
            .map_err(|_| AppError::Invalid("معرف المستودع المصدر غير صالح".into()))?;
        let dest_wh_id = req.dest_warehouse_id.parse::<WarehouseId>()
            .map_err(|_| AppError::Invalid("معرف المستودع الوجهة غير صالح".into()))?;

        let _source_wh = self.warehouse_repo.find_by_id(&source_wh_id).await?
            .ok_or_else(|| AppError::NotFound("المستودع المصدر غير موجود".into()))?;
        let _dest_wh = self.warehouse_repo.find_by_id(&dest_wh_id).await?
            .ok_or_else(|| AppError::NotFound("مستودع الوجهة غير موجود".into()))?;

        let material_id = req.material_id.parse::<MaterialId>()
            .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
        let _material = self.material_repo.find_by_id(&material_id).await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let quantity = Decimal::from_str(&req.quantity)
            .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;

        if quantity <= Decimal::ZERO {
            return Err(AppError::Invalid("الكمية يجب أن تكون موجبة".into()));
        }

        let transfer_date = DateTime::parse_from_rfc3339(&req.transfer_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&Utc);

        let all = self.movement_repo.list_all().await?;
        let mut ref_ins: HashSet<&str> = HashSet::new();
        let mut ref_outs: HashSet<&str> = HashSet::new();
        for m in &all {
            let r = m.reference.as_str();
            match m.movement_type {
                MovementType::In => { ref_ins.insert(r); }
                MovementType::Out => { ref_outs.insert(r); }
                _ => {}
            }
        }
        let transfer_count = ref_ins.intersection(&ref_outs).count();
        let reference = (transfer_count + 1).to_string();

        let mut source_movement = StockMovement::new(
            material_id,
            MovementType::Out,
            quantity,
            Decimal::ZERO,
            Decimal::ZERO,
            reference.clone(),
            req.notes.clone().unwrap_or_default(),
            transfer_date,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;
        source_movement.warehouse_id = Some(source_wh_id);

        let mut dest_movement = StockMovement::new(
            material_id,
            MovementType::In,
            quantity,
            Decimal::ZERO,
            Decimal::ZERO,
            reference.clone(),
            req.notes.clone().unwrap_or_default(),
            transfer_date,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;
        dest_movement.warehouse_id = Some(dest_wh_id);

        let source_id = source_movement.id.to_string();
        let dest_id = dest_movement.id.to_string();

        self.movement_repo.save(&source_movement).await?;
        self.movement_repo.save(&dest_movement).await?;

        Ok(TransferResponse {
            reference,
            source_movement_id: source_id,
            dest_movement_id: dest_id,
            source_warehouse_id: req.source_warehouse_id,
            dest_warehouse_id: req.dest_warehouse_id,
            material_id: req.material_id,
            quantity: quantity.to_string(),
            transfer_date: req.transfer_date,
        })
    }
}
