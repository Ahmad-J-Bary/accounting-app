use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::inventory::ProductionOrder;
use domain::shared::ids::MaterialId;
use crate::ports::production_repository::ProductionRepository;
use crate::dto::production_dto::{
    CreateProductionOrderRequest, ProductionOrderDto,
    ProductionMaterialDto, ProductionOutputDto,
};
use crate::errors::AppError;

fn to_dto(o: ProductionOrder) -> ProductionOrderDto {
    ProductionOrderDto {
        id: o.id.to_string(),
        order_number: o.order_number,
        materials: o.materials.into_iter().map(|m| ProductionMaterialDto {
            id: m.id,
            material_id: m.material_id.to_string(),
            product_name: None,
            quantity_required: m.quantity_required.to_string(),
            quantity_consumed: m.quantity_consumed.to_string(),
        }).collect(),
        outputs: o.outputs.into_iter().map(|out| ProductionOutputDto {
            id: out.id,
            material_id: out.material_id.to_string(),
            product_name: None,
            quantity_produced: out.quantity_produced.to_string(),
            unit_cost: out.unit_cost.to_string(),
        }).collect(),
        status: format!("{:?}", o.status),
        production_date: o.production_date.to_rfc3339(),
        notes: o.notes,
        total_cost: o.total_cost.to_string(),
        created_at: o.created_at.to_rfc3339(),
        updated_at: o.updated_at.to_rfc3339(),
    }
}

pub struct CreateProductionOrderUseCase {
    repo: Arc<dyn ProductionRepository>,
}

impl CreateProductionOrderUseCase {
    pub fn new(repo: Arc<dyn ProductionRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateProductionOrderRequest) -> Result<ProductionOrderDto, AppError> {
        let production_date = DateTime::parse_from_rfc3339(&req.production_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        let mut order = ProductionOrder::new(req.order_number, production_date, req.notes)
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        for mat in req.materials {
            let pid = mat.material_id.parse::<MaterialId>()
                .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
            let qty = Decimal::try_from(mat.quantity_required)
                .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
            order.add_material(pid, qty).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        for out in req.outputs {
            let pid = out.material_id.parse::<MaterialId>()
                .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
            let qty = Decimal::try_from(out.quantity_produced)
                .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
            let cost = Decimal::try_from(out.unit_cost)
                .map_err(|_| AppError::Invalid("التكلفة غير صالحة".into()))?;
            order.add_output(pid, qty, cost).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        self.repo.save(&order).await?;
        Ok(to_dto(order))
    }
}

pub struct ListProductionOrdersUseCase {
    repo: Arc<dyn ProductionRepository>,
}

impl ListProductionOrdersUseCase {
    pub fn new(repo: Arc<dyn ProductionRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<ProductionOrderDto>, AppError> {
        Ok(self.repo.list_all().await?.into_iter().map(to_dto).collect())
    }
}

pub struct GetProductionOrderUseCase {
    repo: Arc<dyn ProductionRepository>,
}

impl GetProductionOrderUseCase {
    pub fn new(repo: Arc<dyn ProductionRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<ProductionOrderDto, AppError> {
        let oid = id.parse().map_err(|_| AppError::NotFound("معرف الأمر غير صالح".into()))?;
        let order = self.repo.find_by_id(&oid).await?
            .ok_or_else(|| AppError::NotFound("أمر الإنتاج غير موجود".into()))?;
        Ok(to_dto(order))
    }
}
