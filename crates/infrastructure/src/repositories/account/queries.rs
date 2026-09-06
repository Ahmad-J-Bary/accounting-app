use super::mappers::row_to_account;
use super::models::AccountRow;
use application::errors::AppError;
use domain::accounting::account::Account;
use domain::shared::ids::AccountId;
use sqlx::SqlitePool;

const BATCH_SIZE: usize = 500;

pub async fn find_by_id(pool: &SqlitePool, id: &AccountId) -> Result<Option<Account>, AppError> {
    let row = sqlx::query_as::<_, AccountRow>("SELECT * FROM accounts WHERE id = ?")
        .bind(id.0.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_account).transpose()
}

pub async fn find_by_code(pool: &SqlitePool, code: &str) -> Result<Option<Account>, AppError> {
    let row = sqlx::query_as::<_, AccountRow>("SELECT * FROM accounts WHERE code = ?")
        .bind(code)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_account).transpose()
}

pub async fn find_by_ids(pool: &SqlitePool, ids: &[AccountId]) -> Result<Vec<Account>, AppError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }

    let mut all_accounts = Vec::new();

    for chunk in ids.chunks(BATCH_SIZE) {
        let placeholders: Vec<&str> = chunk.iter().map(|_| "?").collect();
        let sql = format!(
            "SELECT * FROM accounts WHERE id IN ({}) ORDER BY code ASC",
            placeholders.join(", ")
        );

        let mut query = sqlx::query_as::<_, AccountRow>(&sql);
        for id in chunk {
            query = query.bind(id.0.to_string());
        }

        let rows = query
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        for row in rows {
            all_accounts.push(row_to_account(row)?);
        }
    }

    Ok(all_accounts)
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Account>, AppError> {
    let rows = sqlx::query_as::<_, AccountRow>("SELECT * FROM accounts ORDER BY code ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut accounts = Vec::new();
    for row in rows {
        accounts.push(row_to_account(row)?);
    }
    Ok(accounts)
}

pub async fn get_next_child_code(pool: &SqlitePool, parent_code: &str) -> Result<String, AppError> {
    // نعتبر أن الأبناء لهم أكواد تبدأ بكود الأب
    // نبحث عن أكبر كود حالي تحت هذا الأب
    let row: (Option<String>,) =
        sqlx::query_as("SELECT MAX(code) FROM accounts WHERE code LIKE ? AND length(code) > ?")
            .bind(format!("{}%", parent_code))
            .bind(parent_code.len() as i32)
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(max_code) = row.0 {
        // إذا وجدنا كود، نقوم بزيادة الجزء الأخير
        // نفترض أن الأكواد رقمية
        if let Ok(num) = max_code.parse::<u64>() {
            return Ok((num + 1).to_string());
        }
    }

    // إذا لم نجد أبناء، نبدأ بأول كود (مثلاً كود الأب + 01 للأبناء من المستوى الرابع)
    let suffix = if parent_code.len() == 4 { "01" } else { "1" };
    Ok(format!("{}{}", parent_code, suffix))
}
