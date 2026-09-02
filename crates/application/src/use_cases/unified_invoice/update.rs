use crate::ports::account_repository::AccountRepository;
use crate::ports::category_repository::CategoryRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use domain::sales::invoice_line::InvoiceLine;
use domain::sales::unified_invoice::InvoiceType;
use domain::shared::currency::Currency;
use domain::shared::ids::{CustomerId, InvoiceId, MaterialId, SupplierId};
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use rust_decimal::Decimal;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

use crate::dto::customer_dto::CreateCustomerRequest;
use crate::dto::invoice_dto::{InvoiceDto, UpdateInvoiceRequest};
use crate::dto::supplier_dto::CreateSupplierRequest;
use crate::errors::AppError;
use crate::use_cases::customer::CreateCustomerUseCase;
use crate::use_cases::supplier::CreateSupplierUseCase;

pub struct UpdateInvoiceUseCase {
    repo: Arc<dyn UnifiedInvoiceRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    category_repo: Arc<dyn CategoryRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
}

impl UpdateInvoiceUseCase {
    #[allow(clippy::too_many_arguments)] // 8th arg (opening_migration_repo) added by the opening-balance integration
    pub fn new(
        repo: Arc<dyn UnifiedInvoiceRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        category_repo: Arc<dyn CategoryRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
    ) -> Self {
        Self {
            repo,
            customer_repo,
            supplier_repo,
            account_repo,
            material_repo,
            category_repo,
            journal_repo,
            opening_migration_repo,
        }
    }

    pub async fn execute(&self, req: UpdateInvoiceRequest) -> Result<InvoiceDto, AppError> {
        let invoice_id = InvoiceId(
            Uuid::parse_str(&req.id)
                .map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?,
        );

        let mut invoice = self
            .repo
            .find_by_id(&invoice_id)
            .await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;

        // Resolve Customer
        let mut customer_id = None;
        if let Some(id_str) = req.customer_id {
            if let Ok(id) = CustomerId::from_str(&id_str) {
                customer_id = Some(id);
            }
        }

        if customer_id.is_none() && invoice.invoice_type == InvoiceType::Sales {
            if let Some(name) = req.customer_name.clone() {
                if name != "زبون نقدي" && !name.trim().is_empty() {
                    let create_customer = CreateCustomerUseCase::new(
                        self.customer_repo.clone(),
                        self.account_repo.clone(),
                        self.journal_repo.clone(),
                        self.opening_migration_repo.clone(),
                    );
                    let customer_dto = create_customer
                        .execute(CreateCustomerRequest {
                            code: "".into(),
                            name,
                            phone: None,
                            address: None,
                            account_id: None,
                            debit: None,
                            credit: None,
                            opening_balance: None,
                            currency: None,
                            exchange_rate: None,
                            notes: Some("تم إنشاؤه تلقائياً من تعديل فاتورة مبيعات".into()),
                        })
                        .await?;
                    customer_id = Some(CustomerId::from_str(&customer_dto.id).unwrap());
                }
            }
        }

        // Resolve Supplier
        let mut supplier_id = None;
        if let Some(id_str) = req.supplier_id {
            if let Ok(id) = SupplierId::from_str(&id_str) {
                supplier_id = Some(id);
            }
        }

        if supplier_id.is_none() && invoice.invoice_type == InvoiceType::Purchase {
            if let Some(name) = req.supplier_name.clone() {
                if name != "مورد نقدي" && !name.trim().is_empty() {
                    let create_supplier = CreateSupplierUseCase::new(
                        self.supplier_repo.clone(),
                        self.account_repo.clone(),
                        self.journal_repo.clone(),
                        self.opening_migration_repo.clone(),
                    );
                    let supplier_dto = create_supplier
                        .execute(CreateSupplierRequest {
                            code: "".into(),
                            name,
                            phone: None,
                            address: None,
                            account_id: None,
                            debit: None,
                            credit: None,
                            opening_balance: None,
                            currency: None,
                            exchange_rate: None,
                            notes: Some("تم إنشاؤه تلقائياً من تعديل فاتورة مشتريات".into()),
                        })
                        .await?;
                    supplier_id = Some(SupplierId::from_str(&supplier_dto.id).unwrap());
                }
            }
        }

        invoice.customer_id = customer_id;
        invoice.customer_name = req.customer_name;
        invoice.supplier_id = supplier_id;
        invoice.supplier_name = req.supplier_name;
        invoice.notes = req.notes;

        // Reset lines
        invoice.lines.clear();

        for line_dto in req.lines {
            let material_id = MaterialId::from_str(&line_dto.material_id)
                .map_err(|_| AppError::Invalid("معرف مادة غير صالح".into()))?;

            let quantity = Decimal::from_str(&line_dto.quantity)
                .map_err(|_| AppError::Invalid("كمية غير صالحة".into()))?;

            let currency_code = invoice.currency_code.clone();
            let exchange_rate = invoice.exchange_rate;

            let doc_currency =
                Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false);
            let unit_price = MonetaryAmount::new(
                Money::new(
                    Decimal::from_str(&line_dto.unit_price)
                        .map_err(|_| AppError::Invalid("سعر غير صالح".into()))?,
                    doc_currency.clone(),
                ),
                exchange_rate,
            );

            let to_monetary = |s: Option<String>| {
                s.and_then(|v| {
                    Decimal::from_str(&v).ok().map(|amt| {
                        MonetaryAmount::new(Money::new(amt, doc_currency.clone()), exchange_rate)
                    })
                })
            };

            let purchase_price = to_monetary(line_dto.purchase_price.clone());
            let retail_price = to_monetary(line_dto.retail_price.clone());
            let wholesale_price = to_monetary(line_dto.wholesale_price.clone());
            let semi_wholesale_price = to_monetary(line_dto.semi_wholesale_price.clone());
            let minimum_stock = line_dto
                .minimum_stock
                .as_ref()
                .and_then(|s| Decimal::from_str(s).ok());

            let unit_price_original = line_dto.unit_price_original.clone().and_then(|s| {
                Decimal::from_str(&s)
                    .ok()
                    .map(|amt| Money::new(amt, doc_currency.clone()))
            });
            let purchase_price_original = line_dto.purchase_price_original.clone().and_then(|s| {
                Decimal::from_str(&s)
                    .ok()
                    .map(|amt| Money::new(amt, doc_currency.clone()))
            });
            let profit_amount_original = line_dto.profit_amount_original.clone().and_then(|s| {
                Decimal::from_str(&s)
                    .ok()
                    .map(|amt| Money::new(amt, doc_currency))
            });

            let conversion_factor = line_dto
                .conversion_factor
                .as_ref()
                .and_then(|s| Decimal::from_str(s).ok());

            let discount_percent =
                Decimal::from_str(&line_dto.discount_percent).unwrap_or(Decimal::ZERO);
            let line = InvoiceLine::new(
                None,
                material_id,
                quantity,
                unit_price,
                discount_percent,
                purchase_price,
                retail_price,
                wholesale_price,
                semi_wholesale_price,
                minimum_stock,
                line_dto.unit_id.clone(),
                conversion_factor,
                line_dto.warehouse_id.clone(),
                line_dto.expiry_date.clone(),
                line_dto.notes.clone(),
                unit_price_original,
                purchase_price_original,
                profit_amount_original,
            );
            invoice
                .add_line(line)
                .map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        let doc_currency = Currency::new(
            &invoice.currency_code,
            &invoice.currency_code,
            &invoice.currency_code,
            "",
            2,
            false,
        );
        invoice.tax_amount = MonetaryAmount::new(
            Money::new(
                Decimal::from_str(&req.tax_amount).unwrap_or(Decimal::ZERO),
                doc_currency.clone(),
            ),
            invoice.exchange_rate,
        );
        invoice.discount_amount = MonetaryAmount::new(
            Money::new(
                Decimal::from_str(&req.discount_amount).unwrap_or(Decimal::ZERO),
                doc_currency.clone(),
            ),
            invoice.exchange_rate,
        );
        invoice.extra_costs = MonetaryAmount::new(
            Money::new(
                Decimal::from_str(&req.extra_costs.clone().unwrap_or_default())
                    .unwrap_or(Decimal::ZERO),
                doc_currency,
            ),
            invoice.exchange_rate,
        );
        invoice.recalculate_totals();

        self.repo.update(&invoice).await?;

        let dto = InvoiceDto::from(invoice);
        let queries = crate::use_cases::unified_invoice::InvoiceQueries::new(
            self.repo.clone(),
            self.material_repo.clone(),
            self.customer_repo.clone(),
            self.supplier_repo.clone(),
            self.category_repo.clone(),
        );
        queries.populate_dto(dto).await
    }
}
