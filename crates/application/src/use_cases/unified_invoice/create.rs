use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType};
use domain::sales::invoice_line::InvoiceLine;
use domain::shared::ids::{MaterialId, CustomerId, SupplierId};
use domain::shared::currency::Currency;
use domain::shared::money::Money;
use domain::shared::monetary_amount::MonetaryAmount;
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::category_repository::CategoryRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;

use crate::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto};
use crate::dto::customer_dto::CreateCustomerRequest;
use crate::dto::supplier_dto::CreateSupplierRequest;
use crate::use_cases::customer::CreateCustomerUseCase;
use crate::use_cases::supplier::CreateSupplierUseCase;
use crate::errors::AppError;

pub struct CreateInvoiceUseCase {
    repo: Arc<dyn UnifiedInvoiceRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    category_repo: Arc<dyn CategoryRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl CreateInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn UnifiedInvoiceRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        category_repo: Arc<dyn CategoryRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { repo, customer_repo, supplier_repo, account_repo, material_repo, category_repo, journal_repo }
    }

    pub async fn execute(&self, req: CreateInvoiceRequest) -> Result<InvoiceDto, AppError> {
        let invoice_type = match req.invoice_type.as_str() {
            "Sales" => InvoiceType::Sales,
            "Purchase" => InvoiceType::Purchase,
            "OpeningBalance" => InvoiceType::OpeningBalance,
            _ => return Err(AppError::Invalid("نوع فاتورة غير صالح".into())),
        };

        let mut customer_id = None;
        if let Some(id_str) = req.customer_id {
            if let Ok(id) = CustomerId::from_str(&id_str) {
                customer_id = Some(id);
            }
        }
        
        if customer_id.is_none() && invoice_type == InvoiceType::Sales {
            if let Some(name) = req.customer_name.clone() {
                if name != "زبون نقدي" && !name.trim().is_empty() {
                    // Auto-create customer
                    let create_customer = CreateCustomerUseCase::new(
                        self.customer_repo.clone(),
                        self.account_repo.clone(),
                        self.journal_repo.clone(),
                    );
                    let customer_dto = create_customer.execute(CreateCustomerRequest {
                        code: "".into(),
                        name,
                        phone: None,
                        address: None,
                        account_id: None,
                        debit: None,
                        credit: None,
                        opening_balance: None,
                        currency: None,
                        notes: Some("تم إنشاؤه تلقائياً من فاتورة مبيعات".into()),
                    }).await?;
                    customer_id = Some(CustomerId::from_str(&customer_dto.id).unwrap());
                }
            }
        }

        let mut supplier_id = None;
        if let Some(id_str) = req.supplier_id {
            if let Ok(id) = SupplierId::from_str(&id_str) {
                supplier_id = Some(id);
            }
        }

        if supplier_id.is_none() && invoice_type == InvoiceType::Purchase {
            if let Some(name) = req.supplier_name.clone() {
                if name != "مورد نقدي" && !name.trim().is_empty() {
                    // Auto-create supplier
                    let create_supplier = CreateSupplierUseCase::new(
                        self.supplier_repo.clone(),
                        self.account_repo.clone(),
                        self.journal_repo.clone(),
                    );
                    let supplier_dto = create_supplier.execute(CreateSupplierRequest {
                        code: "".into(),
                        name,
                        phone: None,
                        address: None,
                        account_id: None,
                        debit: None,
                        credit: None,
                        opening_balance: None,
                        currency: None,
                        notes: Some("تم إنشاؤه تلقائياً من فاتورة مشتريات".into()),
                    }).await?;
                    supplier_id = Some(SupplierId::from_str(&supplier_dto.id).unwrap());
                }
            }
        }

        let payment_method = match req.payment_method.as_str() {
            "Cash" => domain::sales::unified_invoice::PaymentMethod::Cash,
            "Deferred" => domain::sales::unified_invoice::PaymentMethod::Deferred,
            "Partial" => domain::sales::unified_invoice::PaymentMethod::Partial,
            _ => domain::sales::unified_invoice::PaymentMethod::Deferred,
        };

        let currency_code = req.currency_code.clone();
        let exchange_rate = Decimal::from_str(&req.exchange_rate).unwrap_or(Decimal::ONE);
        let amount_paid = Money::new(Decimal::from_str(&req.amount_paid).unwrap_or(Decimal::ZERO), Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false));

        let issued_at = chrono::DateTime::parse_from_rfc3339(&req.issued_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let invoice_number = if req.invoice_number.trim().is_empty() || req.invoice_number == "تلقائي" {
            self.repo.get_next_invoice_number(invoice_type.clone()).await?
        } else {
            req.invoice_number
        };

        let mut invoice = UnifiedInvoice::new(
            invoice_number,
            invoice_type,
            customer_id,
            req.customer_name,
            supplier_id,
            req.supplier_name,
            payment_method,
            amount_paid,
            currency_code.clone(),
            exchange_rate,
            issued_at,
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        for line_dto in req.lines {
            let material_id = MaterialId::from_str(&line_dto.material_id)
                .map_err(|_| AppError::Invalid("معرف مادة غير صالح".into()))?;
            
            let quantity = Decimal::from_str(&line_dto.quantity)
                .map_err(|_| AppError::Invalid("كمية غير صالحة".into()))?;
            
            let unit_price = MonetaryAmount::new(
                Money::new(Decimal::from_str(&line_dto.unit_price)
                .map_err(|_| AppError::Invalid("سعر غير صالح".into()))?, Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false)),
                exchange_rate
            );

            let doc_currency = Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false);
            let to_monetary = |s: Option<String>| s.and_then(|v| {
                Decimal::from_str(&v).ok().map(|amt| {
                    MonetaryAmount::new(Money::new(amt, doc_currency.clone()), exchange_rate)
                })
            });

            let purchase_price = to_monetary(line_dto.purchase_price);
            let retail_price = to_monetary(line_dto.retail_price);
            let wholesale_price = to_monetary(line_dto.wholesale_price);
            let semi_wholesale_price = to_monetary(line_dto.semi_wholesale_price);
            let minimum_stock = line_dto.minimum_stock.and_then(|s| Decimal::from_str(&s).ok());
            let unit_price_original = line_dto.unit_price_original.and_then(|s| Decimal::from_str(&s).ok().map(|amt| Money::new(amt, doc_currency.clone())));
            let purchase_price_original = line_dto.purchase_price_original.and_then(|s| Decimal::from_str(&s).ok().map(|amt| Money::new(amt, doc_currency.clone())));
            let profit_amount_original = line_dto.profit_amount_original.and_then(|s| Decimal::from_str(&s).ok().map(|amt| Money::new(amt, doc_currency)));

            let conversion_factor = line_dto.conversion_factor.as_ref()
                .and_then(|s| Decimal::from_str(s).ok());

            let line = InvoiceLine::new(
                material_id,
                quantity,
                unit_price,
                purchase_price,
                retail_price,
                wholesale_price,
                semi_wholesale_price,
                minimum_stock,
                line_dto.unit_id,
                conversion_factor,
                line_dto.notes,
                unit_price_original,
                purchase_price_original,
                profit_amount_original,
            );
            invoice.add_line(line).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        let doc_currency = Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false);
        invoice.tax_amount = MonetaryAmount::new(Money::new(Decimal::from_str(&req.tax_amount).unwrap_or(Decimal::ZERO), doc_currency.clone()), exchange_rate);
        invoice.discount_amount = MonetaryAmount::new(Money::new(Decimal::from_str(&req.discount_amount).unwrap_or(Decimal::ZERO), doc_currency.clone()), exchange_rate);
        invoice.extra_costs = MonetaryAmount::new(Money::new(Decimal::from_str(&req.extra_costs.clone().unwrap_or_default()).unwrap_or(Decimal::ZERO), doc_currency), exchange_rate);
        invoice.recalculate_totals();

        self.repo.save(&invoice).await?;
        
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
