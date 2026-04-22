use std::sync::Arc;
use domain::inventory::product::Product;
use domain::shared::money::Money;
use crate::ports::product_repository::ProductRepository;
use crate::dto::product_dto::{CreateProductRequest, UpdateProductRequest, ProductDto};
use crate::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;

pub struct CreateProductUseCase {
    repo: Arc<dyn ProductRepository>,
}

impl CreateProductUseCase {
    pub fn new(repo: Arc<dyn ProductRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateProductRequest) -> Result<ProductDto, AppError> {
        let unit_price = Decimal::from_str(&req.unit_price).map_err(|_| AppError::Invalid("سعر البيع غير صالح".into()))?;
        let cost_price = Decimal::from_str(&req.cost_price).map_err(|_| AppError::Invalid("سعر التكلفة غير صالح".into()))?;
        let initial_stock = Decimal::from_str(&req.initial_stock).map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
        let minimum_stock = Decimal::from_str(&req.minimum_stock).map_err(|_| AppError::Invalid("الحد الأدنى غير صالح".into()))?;

        let product = Product::new(
            req.name,
            req.code,
            Money::syp(unit_price),
            Money::syp(cost_price),
            initial_stock,
            minimum_stock,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.repo.save(&product).await?;
        Ok(ProductDto::from(product))
    }
}

pub struct UpdateProductUseCase {
    repo: Arc<dyn ProductRepository>,
}

impl UpdateProductUseCase {
    pub fn new(repo: Arc<dyn ProductRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: UpdateProductRequest) -> Result<ProductDto, AppError> {
        let pid = req.id.parse().map_err(|_| AppError::NotFound("معرف المنتج غير صالح".into()))?;
        let mut product = self.repo.find_by_id(&pid).await?
            .ok_or_else(|| AppError::NotFound("المنتج غير موجود".into()))?;
        
        let unit_price = Decimal::from_str(&req.unit_price).map_err(|_| AppError::Invalid("سعر البيع غير صالح".into()))?;
        let cost_price = Decimal::from_str(&req.cost_price).map_err(|_| AppError::Invalid("سعر التكلفة غير صالح".into()))?;
        let stock_quantity = Decimal::from_str(&req.stock_quantity).map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
        let minimum_stock = Decimal::from_str(&req.minimum_stock).map_err(|_| AppError::Invalid("الحد الأدنى غير صالح".into()))?;

        product.name = req.name;
        product.code = req.code;
        product.unit_price = Money::syp(unit_price);
        product.cost_price = Money::syp(cost_price);
        product.stock_quantity = stock_quantity;
        product.minimum_stock = minimum_stock;
        
        if req.is_active {
            product.activate();
        } else {
            product.deactivate();
        }

        self.repo.update(&product).await?;
        Ok(ProductDto::from(product))
    }
}

pub struct ListProductsUseCase {
    repo: Arc<dyn ProductRepository>,
}

impl ListProductsUseCase {
    pub fn new(repo: Arc<dyn ProductRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<ProductDto>, AppError> {
        let products = self.repo.list_all().await?;
        Ok(products.into_iter().map(ProductDto::from).collect())
    }
}

pub struct GetProductUseCase {
    repo: Arc<dyn ProductRepository>,
}

impl GetProductUseCase {
    pub fn new(repo: Arc<dyn ProductRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<ProductDto, AppError> {
        let pid = id.parse().map_err(|_| AppError::NotFound("معرف المنتج غير صالح".into()))?;
        let product = self.repo.find_by_id(&pid).await?
            .ok_or_else(|| AppError::NotFound("المنتج غير موجود".into()))?;

        Ok(ProductDto::from(product))
    }
}

pub struct DeleteProductUseCase {
    repo: Arc<dyn ProductRepository>,
}

impl DeleteProductUseCase {
    pub fn new(repo: Arc<dyn ProductRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let pid = id.parse().map_err(|_| AppError::NotFound("معرف المنتج غير صالح".into()))?;
        self.repo.delete(&pid).await
    }
}
