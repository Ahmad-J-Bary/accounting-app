use application::ports::unit_of_work::UnitOfWork;
use application::errors::AppError;
use crate::db::pool::DbPool;
use async_trait::async_trait;
use tokio::sync::Mutex;
use sqlx::pool::PoolConnection;
use sqlx::Sqlite;

/// Real UnitOfWork for SQLite.
///
/// sqlx cannot hand out a `Transaction<'static, Sqlite>` from a pooled
/// connection (its `Transaction` borrows a `'static` connection on a
/// per-repository model we don't control), so instead this holds a dedicated
/// [`PoolConnection`] for the life of the unit of work and drives it with
/// explicit `BEGIN` / `COMMIT` / `ROLLBACK`. Repositories that participate in
/// the unit of work must execute against the shared connection (the reverse,
/// posting and detail-save flows do), giving genuine cross-repository atomicity
/// without leaking a `Transaction`.
pub struct SqliteUnitOfWork {
    pool: DbPool,
    conn: Mutex<Option<PoolConnection<Sqlite>>>,
    in_tx: Mutex<bool>,
}

impl SqliteUnitOfWork {
    pub fn new(pool: DbPool) -> Self {
        Self {
            pool,
            conn: Mutex::new(None),
            in_tx: Mutex::new(false),
        }
    }

    async fn ensure_conn(&self) -> Result<(), AppError> {
        let mut conn = self.conn.lock().await;
        if conn.is_none() {
            *conn = Some(
                self.pool
                    .acquire()
                    .await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?,
            );
        }
        Ok(())
    }
}

#[async_trait]
impl UnitOfWork for SqliteUnitOfWork {
    async fn begin(&self) -> Result<(), AppError> {
        self.ensure_conn().await?;

        let mut in_tx = self.in_tx.lock().await;
        if *in_tx {
            return Err(AppError::Infrastructure("Transaction already in progress".into()));
        }

        let mut conn = self.conn.lock().await;
        let connection = conn
            .as_mut()
            .ok_or_else(|| AppError::Infrastructure("No connection available".into()))?;

        sqlx::query("BEGIN IMMEDIATE")
            .execute(&mut **connection)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        *in_tx = true;
        Ok(())
    }

    async fn commit(&self) -> Result<(), AppError> {
        let mut in_tx = self.in_tx.lock().await;
        if *in_tx {
            let mut conn = self.conn.lock().await;
            if let Some(conn) = conn.as_mut() {
                sqlx::query("COMMIT")
                    .execute(&mut **conn)
                    .await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            }
            *in_tx = false;
        }
        Ok(())
    }

    async fn rollback(&self) -> Result<(), AppError> {
        let mut in_tx = self.in_tx.lock().await;
        if *in_tx {
            let mut conn = self.conn.lock().await;
            if let Some(conn) = conn.as_mut() {
                sqlx::query("ROLLBACK")
                    .execute(&mut **conn)
                    .await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            }
            *in_tx = false;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;

    async fn make_pool() -> DbPool {
        let mut path = std::env::temp_dir();
        path.push(format!("acc_uow_{}.sqlite", uuid::Uuid::new_v4()));
        let options = SqliteConnectOptions::from_str(path.to_str().unwrap())
            .unwrap()
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(2)
            .connect_with(options)
            .await
            .unwrap();
        sqlx::query("CREATE TABLE IF NOT EXISTS uow_probe (id INTEGER PRIMARY KEY, note TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        Arc::new(pool)
    }

    #[tokio::test]
    async fn rollback_discards_writes_and_commit_persists_them() {
        let pool = make_pool().await;
        let uow = SqliteUnitOfWork::new(pool.clone());

        // --- rollback path ---
        uow.begin().await.unwrap();
        {
            let mut conn = uow.conn.lock().await;
            sqlx::query("INSERT INTO uow_probe (note) VALUES ('transient')")
                .execute(&mut **conn.as_mut().unwrap())
                .await
                .unwrap();
        }
        uow.rollback().await.unwrap();

        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM uow_probe").fetch_one(pool.as_ref()).await.unwrap();
        assert_eq!(count, 0, "rollback must discard the uncommitted insert");

        // --- commit path ---
        uow.begin().await.unwrap();
        {
            let mut conn = uow.conn.lock().await;
            sqlx::query("INSERT INTO uow_probe (note) VALUES ('persistent')")
                .execute(&mut **conn.as_mut().unwrap())
                .await
                .unwrap();
        }
        uow.commit().await.unwrap();

        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM uow_probe").fetch_one(pool.as_ref()).await.unwrap();
        assert_eq!(count, 1, "commit must persist the insert");
    }

    #[tokio::test]
    async fn begin_rejects_nested_transaction() {
        let pool = make_pool().await;
        let uow = SqliteUnitOfWork::new(pool);
        uow.begin().await.unwrap();
        let second = uow.begin().await;
        assert!(second.is_err(), "nested begin must be rejected");
        uow.rollback().await.unwrap();
    }

    #[tokio::test]
    async fn commit_without_begin_is_not_an_error() {
        let pool = make_pool().await;
        let uow = SqliteUnitOfWork::new(pool);
        assert!(uow.commit().await.is_ok());
        assert!(uow.rollback().await.is_ok());
    }
}
