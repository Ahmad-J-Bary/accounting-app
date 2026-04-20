use crate::bootstrap::container::AppState;
use application::dto::product_dto::{CreateProductRequest, UpdateProductRequest, ProductDto};
use application::use_cases::product_use_cases::{
    CreateProductUseCase, UpdateProductUseCase, ListProductsUseCase, GetProductUseCase, DeleteProductUseCase
};
use tauri::State;

#[tauri::command]
pub async fn create_product(
    state: State<'_, AppState>,
    request: CreateProductRequest,
) -> Result<ProductDto, String> {
    let use_case = CreateProductUseCase::new(state.product_repo.clone());
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
