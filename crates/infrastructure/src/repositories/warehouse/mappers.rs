use super::models::WarehouseRow;
use application::dto::warehouse_dto::WarehouseDto;
use application::errors::AppError;

pub fn row_to_dto(row: WarehouseRow) -> Result<WarehouseDto, AppError> {
    Ok(WarehouseDto {
        id: row.id,
        name: row.name,
        address: row.address,
        is_active: row.is_active,
        is_default: row.is_default,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}
