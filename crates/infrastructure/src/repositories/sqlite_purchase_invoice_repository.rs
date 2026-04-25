use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::purchase_invoice_repository::PurchaseInvoiceRepository;
use domain::purchases::{PurchaseInvoice, PurchaseInvoiceItem, PurchaseInvoiceStatus};
use domain::shared::ids::{PurchaseInvoiceId, SupplierId, ProductId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;

pub struct SqlitePurchaseInvoiceRepository {
    pool: Arc<SqlitePool>,
}

impl SqlitePurchaseInvoiceRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct PurchaseInvoiceRow {
    id: String,
    invoice_number: String,
    supplier_id: String,
    subtotal: String,
    tax_amount: String,
    discount_amount: String,
    total: String,
    amount_paid: String,
    status: String,
    invoice_date: String,
    due_date: Option<String>,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(sqlx::FromRow)]
struct PurchaseInvoiceItemRow {
    id: String,
    product_id: String,
    quantity: String,
    unit_price: String,
    line_total: String,
    notes: Option<String>,
}

#[async_trait]
impl PurchaseInvoiceRepository for SqlitePurchaseInvoiceRepository {
    async fn save(&self, invoice: &PurchaseInvoice) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

        sqlx::query(
            "INSERT INTO purchase_invoices (id, invoice_number, supplier_id, subtotal, tax_amount, discount_amount, total, amount_paid, status, invoice_date, due_date, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(invoice.id.to_string())
        .bind(&invoice.invoice_number)
        .bind(invoice.supplier_id.to_string())
        .bind(invoice.subtotal.to_string())
        .bind(invoice.tax_amount.to_string())
        .bind(invoice.discount_amount.to_string())
        .bind(invoice.total.to_string())
        .bind(invoice.amount_paid.to_string())
        .bind(format!("{:?}", invoice.status))
        .bind(invoice.invoice_date.to_rfc3339())
        .bind(invoice.due_date.map(|d| d.to_rfc3339()))
        .bind(&invoice.notes)
        .bind(invoice.created_at.to_rfc3339())
        .bind(invoice.updated_at.to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        for item in &invoice.items {
            sqlx::query(
                "INSERT INTO purchase_invoice_items (id, purchase_invoice_id, product_id, quantity, unit_price, line_total, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&item.id)
            .bind(invoice.id.to_string())
            .bind(item.product_id.to_string())
            .bind(item.quantity.to_string())
            .bind(item.unit_price.to_string())
            .bind(item.line_total.to_string())
            .bind(&item.notes)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }

        tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &PurchaseInvoiceId) -> Result<Option<PurchaseInvoice>, AppError> {
        let row = sqlx::query_as::<_, PurchaseInvoiceRow>(
            "SELECT id, invoice_number, supplier_id, subtotal, tax_amount, discount_amount, total, amount_paid, status, invoice_date, due_date, notes, created_at, updated_at
             FROM purchase_invoices WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(row) = row {
            let items = self.load_items(&row.id).await?;
            let status = match row.status.as_str() {
                "Posted" => PurchaseInvoiceStatus::Posted,
                "Cancelled" => PurchaseInvoiceStatus::Cancelled,
                "Paid" => PurchaseInvoiceStatus::Paid,
                "PartiallyPaid" => PurchaseInvoiceStatus::PartiallyPaid,
                _ => PurchaseInvoiceStatus::Draft,
            };
            Ok(Some(PurchaseInvoice {
                id: PurchaseInvoiceId(Uuid::parse_str(&row.id).unwrap()),
                invoice_number: row.invoice_number,
                supplier_id: SupplierId::from_u64(row.supplier_id.parse::<u64>().unwrap_or(0)),
                items,
                subtotal: Decimal::from_str(&row.subtotal).unwrap_or(Decimal::ZERO),
                tax_amount: Decimal::from_str(&row.tax_amount).unwrap_or(Decimal::ZERO),
                discount_amount: Decimal::from_str(&row.discount_amount).unwrap_or(Decimal::ZERO),
                total: Decimal::from_str(&row.total).unwrap_or(Decimal::ZERO),
                amount_paid: Decimal::from_str(&row.amount_paid).unwrap_or(Decimal::ZERO),
                status,
                invoice_date: DateTime::parse_from_rfc3339(&row.invoice_date).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
                due_date: row.due_date.as_ref().map(|d| DateTime::parse_from_rfc3339(d).map(|dt| dt.with_timezone(&chrono::Utc)).ok()).flatten(),
                notes: row.notes,
                created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
                updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
            }))
        } else {
            Ok(None)
        }
    }

    async fn list_all(&self) -> Result<Vec<PurchaseInvoice>, AppError> {
        let rows = sqlx::query(
            "SELECT id FROM purchase_invoices ORDER BY invoice_date DESC"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut invoices = Vec::new();
        for row in rows {
            use sqlx::Row;
            let id_str: String = row.get("id");
            let id = PurchaseInvoiceId(Uuid::parse_str(&id_str).unwrap());
            if let Some(inv) = self.find_by_id(&id).await? {
                invoices.push(inv);
            }
        }
        Ok(invoices)
    }

    async fn list_by_supplier(&self, supplier_id: &SupplierId) -> Result<Vec<PurchaseInvoice>, AppError> {
        let rows = sqlx::query(
            "SELECT id FROM purchase_invoices WHERE supplier_id = ? ORDER BY invoice_date DESC"
        )
        .bind(supplier_id.to_string())
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut invoices = Vec::new();
        for row in rows {
            use sqlx::Row;
            let id_str: String = row.get("id");
            let id = PurchaseInvoiceId(Uuid::parse_str(&id_str).unwrap());
            if let Some(inv) = self.find_by_id(&id).await? {
                invoices.push(inv);
            }
        }
        Ok(invoices)
    }

    async fn update(&self, invoice: &PurchaseInvoice) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE purchase_invoices SET status=?, amount_paid=?, total=?, subtotal=?, tax_amount=?, discount_amount=?, updated_at=?
             WHERE id=?"
        )
        .bind(format!("{:?}", invoice.status))
        .bind(invoice.amount_paid.to_string())
        .bind(invoice.total.to_string())
        .bind(invoice.subtotal.to_string())
        .bind(invoice.tax_amount.to_string())
        .bind(invoice.discount_amount.to_string())
        .bind(invoice.updated_at.to_rfc3339())
        .bind(invoice.id.to_string())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &PurchaseInvoiceId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM purchase_invoices WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

impl SqlitePurchaseInvoiceRepository {
    async fn load_items(&self, invoice_id: &str) -> Result<Vec<PurchaseInvoiceItem>, AppError> {
        let rows = sqlx::query_as::<_, PurchaseInvoiceItemRow>(
            "SELECT id, product_id, quantity, unit_price, line_total, notes
             FROM purchase_invoice_items WHERE purchase_invoice_id = ?"
        )
        .bind(invoice_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(|r| PurchaseInvoiceItem {
            id: r.id,
            product_id: ProductId(Uuid::parse_str(&r.product_id).unwrap()),
            quantity: Decimal::from_str(&r.quantity).unwrap_or(Decimal::ZERO),
            unit_price: Decimal::from_str(&r.unit_price).unwrap_or(Decimal::ZERO),
            line_total: Decimal::from_str(&r.line_total).unwrap_or(Decimal::ZERO),
            notes: r.notes,
        }).collect())
    }
}

