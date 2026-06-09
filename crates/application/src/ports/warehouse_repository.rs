use async_trait::async_trait;
use crate::errors::AppError;
use crate::dto::warehouse_dto::{WarehouseDto, CreateWarehouseRequest, UpdateWarehouseRequest};
use domain::shared::ids::WarehouseId;

#[async_trait]
pub trait WarehouseRepository: Send + Sync {
    async fn create(&self, req: &CreateWarehouseRequest) -> Result<WarehouseDto, AppError>;
    async fn find_by_id(&self, id: &WarehouseId) -> Result<Option<WarehouseDto>, AppError>;
    async fn list_all(&self) -> Result<Vec<WarehouseDto>, AppError>;
    async fn update(&self, req: &UpdateWarehouseRequest) -> Result<WarehouseDto, AppError>;
    async fn delete(&self, id: &WarehouseId) -> Result<(), AppError>;
    async fn get_default(&self) -> Result<Option<WarehouseDto>, AppError>;
}
