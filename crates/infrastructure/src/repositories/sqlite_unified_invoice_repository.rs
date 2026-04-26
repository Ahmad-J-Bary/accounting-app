use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType, InvoiceStatus};
use domain::sales::invoice_line::InvoiceLine;
use domain::shared::ids::{InvoiceId, MaterialId, CustomerId, SupplierId};
use domain::shared::money::Money;
use std::sync::Arc;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;

pub struct SqliteUnifiedInvoiceRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteUnifiedInvoiceRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct InvoiceRow {
    id: String,
    invoice_number: String,
    invoice_type: String,
    customer_id: Option<String>,
    supplier_id: Option<String>,
    tax_amount: String,
    discount_amount: String,
    total_amount: String,
    status: String,
    issued_at: String,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(sqlx::FromRow)]
struct LineRow {
    _id: String,
    _invoice_id: String,
    material_id: String,
    quantity: String,
    unit_price: String,
    purchase_price: Option<String>,
    retail_price: Option<String>,
    wholesale_price: Option<String>,
    semi_wholesale_price: Option<String>,
    minimum_stock: Option<String>,
    notes: Option<String>,
}

async fn get_lines(pool: &SqlitePool, invoice_id: &str) -> Result<Vec<InvoiceLine>, AppError> {
    let rows = sqlx::query_as::<_, LineRow>("SELECT * FROM unified_invoice_lines WHERE invoice_id = ?")
        .bind(invoice_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut lines = vec![];
    for r in rows {
        let material_id = MaterialId(Uuid::parse_str(&r.material_id).map_err(|e| AppError::Infrastructure(e.to_string()))?);
        let quantity = Decimal::from_str(&r.quantity).unwrap_or(Decimal::ZERO);
        let unit_price = Money::syp(Decimal::from_str(&r.unit_price).unwrap_or(Decimal::ZERO));
        
        let parse_money = |s: Option<String>| s.and_then(|v| Decimal::from_str(&v).ok().map(Money::syp));
        
        lines.push(InvoiceLine::new(
            material_id,
            quantity,
            unit_price,
            parse_money(r.purchase_price),
            parse_money(r.retail_price),
            parse_money(r.wholesale_price),
            parse_money(r.semi_wholesale_price),
            r.minimum_stock.and_then(|v| Decimal::from_str(&v).ok()),
            r.notes,
        ));
    }
    Ok(lines)
}

fn row_to_invoice(row: InvoiceRow, lines: Vec<InvoiceLine>) -> Result<UnifiedInvoice, AppError> {
    let invoice_type = match row.invoice_type.as_str() {
        "Sales" => InvoiceType::Sales,
        "Purchase" => InvoiceType::Purchase,
        "OpeningBalance" => InvoiceType::OpeningBalance,
        _ => InvoiceType::Sales,
    };

    let status = match row.status.as_str() {
        "Draft" => InvoiceStatus::Draft,
        "Posted" => InvoiceStatus::Posted,
        "Cancelled" => InvoiceStatus::Cancelled,
        "Reversed" => InvoiceStatus::Reversed,
        _ => InvoiceStatus::Draft,
    };

    Ok(UnifiedInvoice {
        id: InvoiceId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        invoice_number: row.invoice_number,
        invoice_type,
        customer_id: row.customer_id.and_then(|id| id.parse::<u64>().ok().map(CustomerId)),
        supplier_id: row.supplier_id.and_then(|id| id.parse::<u64>().ok().map(SupplierId)),
        lines,
        tax_amount: Money::syp(Decimal::from_str(&row.tax_amount).unwrap_or(Decimal::ZERO)),
        discount_amount: Money::syp(Decimal::from_str(&row.discount_amount).unwrap_or(Decimal::ZERO)),
        total_amount: Money::syp(Decimal::from_str(&row.total_amount).unwrap_or(Decimal::ZERO)),
        status,
        issued_at: DateTime::parse_from_rfc3339(&row.issued_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        notes: row.notes,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}

#[async_trait]
impl UnifiedInvoiceRepository for SqliteUnifiedInvoiceRepository {
    async fn save(&self, invoice: &UnifiedInvoice) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let itype = match invoice.invoice_type {
            InvoiceType::Sales => "Sales",
            InvoiceType::Purchase => "Purchase",
            InvoiceType::OpeningBalance => "OpeningBalance",
        };

        let istatus = match invoice.status {
            InvoiceStatus::Draft => "Draft",
            InvoiceStatus::Posted => "Posted",
            InvoiceStatus::Cancelled => "Cancelled",
            InvoiceStatus::Reversed => "Reversed",
        };

        sqlx::query(
            "INSERT INTO unified_invoices (id, invoice_number, invoice_type, customer_id, supplier_id, tax_amount, discount_amount, total_amount, status, issued_at, notes, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(invoice.id.to_string())
        .bind(&invoice.invoice_number)
        .bind(itype)
        .bind(invoice.customer_id.as_ref().map(|id| id.to_string()))
        .bind(invoice.supplier_id.as_ref().map(|id| id.to_string()))
        .bind(invoice.tax_amount.amount().to_string())
        .bind(invoice.discount_amount.amount().to_string())
        .bind(invoice.total_amount.amount().to_string())
        .bind(istatus)
        .bind(invoice.issued_at.to_rfc3339())
        .bind(&invoice.notes)
        .bind(invoice.created_at.to_rfc3339())
        .bind(invoice.updated_at.to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        for line in &invoice.lines {
            sqlx::query(
                "INSERT INTO unified_invoice_lines (id, invoice_id, material_id, quantity, unit_price, purchase_price, retail_price, wholesale_price, semi_wholesale_price, minimum_stock, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(Uuid::new_v4().to_string())
            .bind(invoice.id.to_string())
            .bind(line.material_id.to_string())
            .bind(line.quantity.to_string())
            .bind(line.unit_price.amount().to_string())
            .bind(line.purchase_price.as_ref().map(|m| m.amount().to_string()))
            .bind(line.retail_price.as_ref().map(|m| m.amount().to_string()))
            .bind(line.wholesale_price.as_ref().map(|m| m.amount().to_string()))
            .bind(line.semi_wholesale_price.as_ref().map(|m| m.amount().to_string()))
            .bind(line.minimum_stock.as_ref().map(|s| s.to_string()))
            .bind(&line.notes)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }

        tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &InvoiceId) -> Result<Option<UnifiedInvoice>, AppError> {
        let row = sqlx::query_as::<_, InvoiceRow>(
            "SELECT * FROM unified_invoices WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(r) = row {
            let lines = get_lines(&self.pool, &r.id).await?;
            Ok(Some(row_to_invoice(r, lines)?))
        } else {
            Ok(None)
        }
    }

    async fn list_all(&self) -> Result<Vec<UnifiedInvoice>, AppError> {
        let rows = sqlx::query_as::<_, InvoiceRow>(
            "SELECT * FROM unified_invoices ORDER BY issued_at DESC"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut invoices = vec![];
        for r in rows {
            let lines = get_lines(&self.pool, &r.id).await?;
            invoices.push(row_to_invoice(r, lines)?);
        }
        Ok(invoices)
    }

    async fn list_by_type(&self, invoice_type: InvoiceType) -> Result<Vec<UnifiedInvoice>, AppError> {
        let itype = match invoice_type {
            InvoiceType::Sales => "Sales",
            InvoiceType::Purchase => "Purchase",
            InvoiceType::OpeningBalance => "OpeningBalance",
        };

        let rows = sqlx::query_as::<_, InvoiceRow>(
            "SELECT * FROM unified_invoices WHERE invoice_type = ? ORDER BY issued_at DESC"
        )
        .bind(itype)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut invoices = vec![];
        for r in rows {
            let lines = get_lines(&self.pool, &r.id).await?;
            invoices.push(row_to_invoice(r, lines)?);
        }
        Ok(invoices)
    }

    async fn update(&self, invoice: &UnifiedInvoice) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let istatus = match invoice.status {
            InvoiceStatus::Draft => "Draft",
            InvoiceStatus::Posted => "Posted",
            InvoiceStatus::Cancelled => "Cancelled",
            InvoiceStatus::Reversed => "Reversed",
        };

        sqlx::query(
            "UPDATE unified_invoices SET status=?, tax_amount=?, discount_amount=?, total_amount=?, notes=?, updated_at=? WHERE id=?"
        )
        .bind(istatus)
        .bind(invoice.tax_amount.amount().to_string())
        .bind(invoice.discount_amount.amount().to_string())
        .bind(invoice.total_amount.amount().to_string())
        .bind(&invoice.notes)
        .bind(invoice.updated_at.to_rfc3339())
        .bind(invoice.id.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        // Simplified: delete lines and re-insert if status is draft
        if invoice.status == InvoiceStatus::Draft {
            sqlx::query("DELETE FROM unified_invoice_lines WHERE invoice_id = ?")
                .bind(invoice.id.to_string())
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;

            for line in &invoice.lines {
                sqlx::query(
                    "INSERT INTO unified_invoice_lines (id, invoice_id, material_id, quantity, unit_price, purchase_price, retail_price, wholesale_price, semi_wholesale_price, minimum_stock, notes) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .bind(Uuid::new_v4().to_string())
                .bind(invoice.id.to_string())
                .bind(line.material_id.to_string())
                .bind(line.quantity.to_string())
                .bind(line.unit_price.amount().to_string())
                .bind(line.purchase_price.as_ref().map(|m| m.amount().to_string()))
                .bind(line.retail_price.as_ref().map(|m| m.amount().to_string()))
                .bind(line.wholesale_price.as_ref().map(|m| m.amount().to_string()))
                .bind(line.semi_wholesale_price.as_ref().map(|m| m.amount().to_string()))
                .bind(line.minimum_stock.as_ref().map(|s| s.to_string()))
                .bind(&line.notes)
                .execute(&mut *tx)
                .await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            }
        }

        tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &InvoiceId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM unified_invoices WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}
