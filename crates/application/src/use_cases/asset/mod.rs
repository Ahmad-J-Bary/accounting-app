pub mod fixed_asset;
pub mod consumable;

pub use fixed_asset::{FixedAssetUseCases, CreateAssetRequest, RotationResult};
pub use consumable::{ConsumableUseCases, CreateConsumableRequest};
