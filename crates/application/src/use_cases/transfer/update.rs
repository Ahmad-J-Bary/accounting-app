use std::sync::Arc;
use std::str::FromStr;
use chrono::{DateTime, Utc};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::shared::ids::{MaterialId, WarehouseId};
use rust_decimal::Decimal;
use crate::dto::transfer_dto::{UpdateTransferRequest, TransferResponse};
use crate::errors::AppError;
use crate::ports::stock_movement_repository::StockMovementRepository;

pub struct UpdateTransferUseCase {
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl UpdateTransferUseCase {
    pub fn new(movement_repo: Arc<dyn StockMovementRepository>) -> Self {
        Self { movement_repo }
    }

    pub async fn execute(&self, req: UpdateTransferRequest) -> Result<TransferResponse, AppError> {
        let movements = self.movement_repo.list_by_reference(&req.reference).await?;
        let has_out = movements.iter().any(|m| matches!(m.movement_type, MovementType::Out));
        let has_in = movements.iter().any(|m| matches!(m.movement_type, MovementType::In));
        if !has_out || !has_in {
            return Err(AppError::NotFound("التحويل غير موجود".into()));
        }

        if req.source_warehouse_id == req.dest_warehouse_id {
            return Err(AppError::Invalid("لا يمكن التحويل إلى نفس المستودع".into()));
        }

        let source_wh_id = req.source_warehouse_id.parse::<WarehouseId>()
            .map_err(|_| AppError::Invalid("معرف المستودع المصدر غير صالح".into()))?;
        let dest_wh_id = req.dest_warehouse_id.parse::<WarehouseId>()
            .map_err(|_| AppError::Invalid("معرف مستودع الوجهة غير صالح".into()))?;
        let material_id = req.material_id.parse::<MaterialId>()
            .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
        let quantity = Decimal::from_str(&req.quantity)
            .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
        if quantity <= Decimal::ZERO {
            return Err(AppError::Invalid("الكمية يجب أن تكون موجبة".into()));
        }
        let transfer_date = DateTime::parse_from_rfc3339(&req.transfer_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&Utc);

        self.movement_repo.delete_by_reference(&req.reference, "Out").await?;
        self.movement_repo.delete_by_reference(&req.reference, "In").await?;

        let mut source_movement = StockMovement::new(
            material_id,
            MovementType::Out,
            quantity,
            Decimal::ZERO,
            Decimal::ZERO,
            req.reference.clone(),
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
            req.reference.clone(),
            req.notes.clone().unwrap_or_default(),
            transfer_date,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;
        dest_movement.warehouse_id = Some(dest_wh_id);

        let source_id = source_movement.id.to_string();
        let dest_id = dest_movement.id.to_string();

        self.movement_repo.save(&source_movement).await?;
        self.movement_repo.save(&dest_movement).await?;

        Ok(TransferResponse {
            reference: req.reference,
            source_movement_id: source_id,
            dest_movement_id: dest_id,
            source_warehouse_id: req.source_warehouse_id,
            dest_warehouse_id: req.dest_warehouse_id,
            material_id: req.material_id,
            quantity: req.quantity,
            transfer_date: req.transfer_date,
        })
    }
}
