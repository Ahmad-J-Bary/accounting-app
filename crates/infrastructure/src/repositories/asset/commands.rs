use application::errors::AppError;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::JournalEntry;
use domain::assets::{AssetCategory, AssetMovement, DepreciationSchedule, FixedAsset};
use sqlx::SqlitePool;

async fn save_asset_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    asset: &FixedAsset,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO fixed_assets (id, code, name, category_id, warehouse_id, purchase_date, purchase_cost, currency, fx_rate, useful_life_months, salvage_value, accumulated_depreciation, status, location, notes, asset_account_id, depreciation_account_id, accumulated_depreciation_account_id, depreciation_method, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(asset.id.0.to_string())
    .bind(&asset.code)
    .bind(&asset.name)
    .bind(asset.category_id.to_string())
    .bind(asset.warehouse_id.map(|id| id.to_string()))
    .bind(asset.purchase_date.to_rfc3339())
    .bind(asset.purchase_cost.amount().to_string())
    .bind(asset.purchase_cost.currency().code.clone())
    .bind(asset.fx_rate.to_string())
    .bind(asset.useful_life_months as i64)
    .bind(asset.salvage_value.as_ref().map(|m| m.amount().to_string()))
    .bind(asset.accumulated_depreciation.amount().to_string())
    .bind(format!("{:?}", asset.status))
    .bind(&asset.location)
    .bind(&asset.notes)
    .bind(asset.asset_account_id.to_string())
    .bind(asset.depreciation_account_id.to_string())
    .bind(asset.accumulated_depreciation_account_id.to_string())
    .bind(format!("{:?}", asset.depreciation_method))
    .bind(asset.created_at.to_rfc3339())
    .bind(asset.updated_at.to_rfc3339())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

async fn save_movement_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    movement: &AssetMovement,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO asset_movements (id, asset_id, movement_type, movement_date, quantity, amount, currency, description, reference_no, journal_entry_id, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(movement.id.to_string())
    .bind(movement.asset_id.to_string())
    .bind(format!("{:?}", movement.movement_type))
    .bind(movement.date.to_rfc3339())
    .bind(movement.quantity.map(|q| q.to_string()))
    .bind(movement.amount.amount().to_string())
    .bind(movement.amount.currency().code.clone())
    .bind(&movement.description)
    .bind(&movement.reference_no)
    .bind(movement.journal_entry_id.map(|id| id.to_string()))
    .bind(movement.created_at.to_rfc3339())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

async fn update_account_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    account: &Account,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE accounts SET debit = ?, credit = ?, balance = ?, updated_at = ? WHERE id = ?",
    )
    .bind(account.debit.to_string())
    .bind(account.credit.to_string())
    .bind(account.balance.to_string())
    .bind(account.updated_at.to_rfc3339())
    .bind(account.id.0.to_string())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Atomically saves the asset + its movements + its journal entries + the
/// affected account balance changes in ONE transaction (Sec 9 atomicity).
#[allow(clippy::too_many_arguments)]
pub async fn save_asset_with_accounting(
    pool: &SqlitePool,
    asset: &FixedAsset,
    movements: &[AssetMovement],
    entries: &[JournalEntry],
    accounts: &[Account],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    save_asset_tx(&mut tx, asset).await?;
    for movement in movements {
        save_movement_tx(&mut tx, movement).await?;
    }
    for entry in entries {
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    }
    for account in accounts {
        update_account_tx(&mut tx, account).await?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Atomically deletes the asset + its movements + the given journal entries
/// in ONE transaction. Only drafts may be deleted (Sec 9 atomicity).
pub async fn delete_asset_with_accounting(
    pool: &SqlitePool,
    id: &domain::assets::FixedAssetId,
    entries: &[domain::shared::ids::JournalEntryId],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for entry_id in entries {
        sqlx::query("DELETE FROM journal_lines WHERE journal_entry_id = ?")
            .bind(entry_id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        sqlx::query("DELETE FROM journal_entries WHERE id = ?")
            .bind(entry_id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    sqlx::query("DELETE FROM asset_movements WHERE asset_id = ?")
        .bind(id.0.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    sqlx::query("DELETE FROM fixed_assets WHERE id = ?")
        .bind(id.0.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn save_asset(pool: &SqlitePool, asset: &FixedAsset) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO fixed_assets (id, code, name, category_id, warehouse_id, purchase_date, purchase_cost, currency, fx_rate, useful_life_months, salvage_value, accumulated_depreciation, status, location, notes, asset_account_id, depreciation_account_id, accumulated_depreciation_account_id, depreciation_method, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(asset.id.0.to_string())
    .bind(&asset.code)
    .bind(&asset.name)
    .bind(asset.category_id.to_string())
    .bind(asset.warehouse_id.map(|id| id.to_string()))
    .bind(asset.purchase_date.to_rfc3339())
    .bind(asset.purchase_cost.amount().to_string())
    .bind(asset.purchase_cost.currency().code.clone())
    .bind(asset.fx_rate.to_string())
    .bind(asset.useful_life_months as i64)
    .bind(asset.salvage_value.as_ref().map(|m| m.amount().to_string()))
    .bind(asset.accumulated_depreciation.amount().to_string())
    .bind(format!("{:?}", asset.status))
    .bind(&asset.location)
    .bind(&asset.notes)
    .bind(asset.asset_account_id.to_string())
    .bind(asset.depreciation_account_id.to_string())
    .bind(asset.accumulated_depreciation_account_id.to_string())
    .bind(format!("{:?}", asset.depreciation_method))
    .bind(asset.created_at.to_rfc3339())
    .bind(asset.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn save_category(pool: &SqlitePool, category: &AssetCategory) -> Result<(), AppError> {
    sqlx::query("INSERT OR REPLACE INTO asset_categories (id, name, asset_type) VALUES (?, ?, ?)")
        .bind(category.id.to_string())
        .bind(&category.name)
        .bind(format!("{:?}", category.asset_type))
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn save_movement(pool: &SqlitePool, movement: &AssetMovement) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO asset_movements (id, asset_id, movement_type, movement_date, quantity, amount, currency, description, reference_no, journal_entry_id, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(movement.id.to_string())
    .bind(movement.asset_id.to_string())
    .bind(format!("{:?}", movement.movement_type))
    .bind(movement.date.to_rfc3339())
    .bind(movement.quantity.map(|q| q.to_string()))
    .bind(movement.amount.amount().to_string())
    .bind(movement.amount.currency().code.clone())
    .bind(&movement.description)
    .bind(&movement.reference_no)
    .bind(movement.journal_entry_id.map(|id| id.to_string()))
    .bind(movement.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn save_depreciation_schedule(
    pool: &SqlitePool,
    schedule: &DepreciationSchedule,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO depreciation_schedules (id, fixed_asset_id, period_date, depreciation_amount, accumulated_depreciation, remaining_value, currency, status, journal_entry_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(schedule.id.to_string())
    .bind(schedule.fixed_asset_id.to_string())
    .bind(schedule.period_date.to_rfc3339())
    .bind(schedule.depreciation_amount.amount().to_string())
    .bind(schedule.accumulated_depreciation.amount().to_string())
    .bind(schedule.remaining_value.amount().to_string())
    .bind(schedule.depreciation_amount.currency().code.clone())
    .bind(format!("{:?}", schedule.status))
    .bind(schedule.journal_entry_id.map(|id| id.to_string()))
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
