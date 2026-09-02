pub mod consumable;
pub mod fixed_asset;

pub use consumable::{ConsumableUseCases, CreateConsumableRequest};
pub use fixed_asset::{CreateAssetRequest, FixedAssetUseCases, RotationResult};
