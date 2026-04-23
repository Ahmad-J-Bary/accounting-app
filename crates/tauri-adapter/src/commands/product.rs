use crate::bootstrap::container::AppState;
use application::dto::product_dto::{CreateProductRequest, UpdateProductRequest, ProductDto};
use application::dto::stock_dto::RecordOpeningStockRequest;
use application::use_cases::product_use_cases::{
    CreateProductUseCase, UpdateProductUseCase, ListProductsUseCase, GetProductUseCase, DeleteProductUseCase
};
use application::use_cases::opening_stock_use_cases::RecordOpeningStockUseCase;
use tauri::State;

#[tauri::command]
pub async fn create_product(
    state: State<'_, AppState>,
    request: CreateProductRequest,
) -> Result<ProductDto, String> {
    let use_case = CreateProductUseCase::new(
        state.product_repo.clone(),
    );
    use_case.execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_product(
    state: State<'_, AppState>,
    id: String,
) -> Result<ProductDto, String> {
    let use_case = GetProductUseCase::new(state.product_repo.clone());
    use_case.execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_products(
    state: State<'_, AppState>,
) -> Result<Vec<ProductDto>, String> {
    let use_case = ListProductsUseCase::new(state.product_repo.clone());
    use_case.execute().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_product(
    state: State<'_, AppState>,
    request: UpdateProductRequest,
) -> Result<ProductDto, String> {
    let use_case = UpdateProductUseCase::new(state.product_repo.clone());
    use_case.execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_product(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let use_case = DeleteProductUseCase::new(state.product_repo.clone());
    use_case.execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn record_opening_stock(
    state: State<'_, AppState>,
    request: RecordOpeningStockRequest,
) -> Result<(), String> {
    let use_case = RecordOpeningStockUseCase::new(
        state.product_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
    );
    use_case.execute(request).await.map_err(|e| e.to_string())
}
