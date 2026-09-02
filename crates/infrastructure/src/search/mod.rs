use std::sync::Arc;

use application::dto::search_dto::{SearchDestinationDto, SearchQueryRequest, SearchResultDto};
use application::errors::AppError;
use application::ports::account_repository::AccountRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::search_provider::SearchProvider;
use application::ports::supplier_repository::SupplierRepository;
use async_trait::async_trait;
use domain::accounting::account::Account;
use domain::accounting::partner::Partner;
use domain::customers::Customer;
use domain::inventory::material::Material;
use domain::suppliers::Supplier;

pub struct SqliteAccountSearchProvider {
    repo: Arc<dyn AccountRepository>,
}

pub struct SqliteCustomerSearchProvider {
    repo: Arc<dyn CustomerRepository>,
}

pub struct SqliteSupplierSearchProvider {
    repo: Arc<dyn SupplierRepository>,
}

pub struct SqlitePartnerSearchProvider {
    repo: Arc<dyn PartnerRepository>,
}

pub struct SqliteMaterialSearchProvider {
    repo: Arc<dyn MaterialRepository>,
}

impl SqliteAccountSearchProvider {
    pub fn new(repo: Arc<dyn AccountRepository>) -> Self {
        Self { repo }
    }
}

impl SqliteCustomerSearchProvider {
    pub fn new(repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo }
    }
}

impl SqliteSupplierSearchProvider {
    pub fn new(repo: Arc<dyn SupplierRepository>) -> Self {
        Self { repo }
    }
}

impl SqlitePartnerSearchProvider {
    pub fn new(repo: Arc<dyn PartnerRepository>) -> Self {
        Self { repo }
    }
}

impl SqliteMaterialSearchProvider {
    pub fn new(repo: Arc<dyn MaterialRepository>) -> Self {
        Self { repo }
    }
}

#[async_trait]
impl SearchProvider for SqliteAccountSearchProvider {
    fn provider_id(&self) -> &'static str {
        "accounts"
    }

    async fn search(&self, request: &SearchQueryRequest) -> Result<Vec<SearchResultDto>, AppError> {
        if !matches_entity_type(request, &["account"]) {
            return Ok(Vec::new());
        }

        let query = normalize(&request.query);
        let mut items = self
            .repo
            .list_all()
            .await?
            .into_iter()
            .filter(|account| account.is_active)
            .filter_map(|account| map_account_result(&query, account))
            .collect::<Vec<_>>();
        sort_and_truncate(&mut items, request.limit);
        Ok(items)
    }
}

#[async_trait]
impl SearchProvider for SqliteCustomerSearchProvider {
    fn provider_id(&self) -> &'static str {
        "customers"
    }

    async fn search(&self, request: &SearchQueryRequest) -> Result<Vec<SearchResultDto>, AppError> {
        if !matches_entity_type(request, &["customer"]) {
            return Ok(Vec::new());
        }

        let query = normalize(&request.query);
        let mut items = self
            .repo
            .list_all()
            .await?
            .into_iter()
            .filter(|customer| customer.is_active)
            .filter_map(|customer| map_customer_result(&query, customer))
            .collect::<Vec<_>>();
        sort_and_truncate(&mut items, request.limit);
        Ok(items)
    }
}

#[async_trait]
impl SearchProvider for SqliteSupplierSearchProvider {
    fn provider_id(&self) -> &'static str {
        "suppliers"
    }

    async fn search(&self, request: &SearchQueryRequest) -> Result<Vec<SearchResultDto>, AppError> {
        if !matches_entity_type(request, &["supplier"]) {
            return Ok(Vec::new());
        }

        let query = normalize(&request.query);
        let mut items = self
            .repo
            .list_all()
            .await?
            .into_iter()
            .filter(|supplier| supplier.is_active)
            .filter_map(|supplier| map_supplier_result(&query, supplier))
            .collect::<Vec<_>>();
        sort_and_truncate(&mut items, request.limit);
        Ok(items)
    }
}

#[async_trait]
impl SearchProvider for SqlitePartnerSearchProvider {
    fn provider_id(&self) -> &'static str {
        "partners"
    }

    async fn search(&self, request: &SearchQueryRequest) -> Result<Vec<SearchResultDto>, AppError> {
        if !matches_entity_type(request, &["partner"]) {
            return Ok(Vec::new());
        }

        let query = normalize(&request.query);
        let mut items = self
            .repo
            .list_all(false)
            .await?
            .into_iter()
            .filter_map(|partner| map_partner_result(&query, partner))
            .collect::<Vec<_>>();
        sort_and_truncate(&mut items, request.limit);
        Ok(items)
    }
}

#[async_trait]
impl SearchProvider for SqliteMaterialSearchProvider {
    fn provider_id(&self) -> &'static str {
        "materials"
    }

    async fn search(&self, request: &SearchQueryRequest) -> Result<Vec<SearchResultDto>, AppError> {
        if !matches_entity_type(request, &["material", "inventory_item"]) {
            return Ok(Vec::new());
        }

        let query = normalize(&request.query);
        let mut items = self
            .repo
            .list_all()
            .await?
            .into_iter()
            .filter_map(|material| map_material_result(&query, material))
            .collect::<Vec<_>>();
        sort_and_truncate(&mut items, request.limit);
        Ok(items)
    }
}

fn matches_entity_type(request: &SearchQueryRequest, supported: &[&str]) -> bool {
    match request.entity_type.as_deref() {
        None => true,
        Some(value) => supported
            .iter()
            .any(|item| item.eq_ignore_ascii_case(value)),
    }
}

fn normalize(value: &str) -> String {
    value.trim().to_lowercase()
}

fn contains_query(query: &str, candidate: &str) -> bool {
    candidate.to_lowercase().contains(query)
}

fn base_score(
    query: &str,
    code: &str,
    primary_name: &str,
    secondary_name: Option<&str>,
) -> Option<i64> {
    if code.eq_ignore_ascii_case(query) {
        Some(120)
    } else if contains_query(query, primary_name) {
        Some(90)
    } else if secondary_name.is_some_and(|value| contains_query(query, value)) {
        Some(75)
    } else if contains_query(query, code) {
        Some(70)
    } else {
        None
    }
}

fn sort_and_truncate(items: &mut Vec<SearchResultDto>, limit: Option<usize>) {
    items.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.title.cmp(&right.title))
    });
    if let Some(limit) = limit {
        if items.len() > limit {
            items.truncate(limit);
        }
    }
}

fn map_account_result(query: &str, account: Account) -> Option<SearchResultDto> {
    let score = base_score(
        query,
        &account.code,
        &account.name_ar,
        Some(&account.name_en),
    )?;
    Some(SearchResultDto {
        id: format!("account:{}", account.id),
        result_type: "account".into(),
        title: account.name_ar,
        subtitle: Some(account.code),
        icon: Some("BookOpen".into()),
        provider: "accounts".into(),
        destination: SearchDestinationDto {
            route_id: "accounting-ledger".into(),
            route_path: Some("/accounting/reports/ledger".into()),
            module_id: "accounting".into(),
            entity_type: Some("account".into()),
            entity_id: Some(account.id.to_string()),
        },
        permission_keys: vec!["ViewAccounts".into()],
        score,
    })
}

fn map_customer_result(query: &str, customer: Customer) -> Option<SearchResultDto> {
    let score = base_score(
        query,
        &customer.code,
        &customer.name,
        customer.phone.as_deref(),
    )?;
    Some(SearchResultDto {
        id: format!("customer:{}", customer.id),
        result_type: "customer".into(),
        title: customer.name,
        subtitle: Some(customer.code),
        icon: Some("Users".into()),
        provider: "customers".into(),
        destination: SearchDestinationDto {
            route_id: "customers".into(),
            route_path: Some("/customers".into()),
            module_id: "parties".into(),
            entity_type: Some("customer".into()),
            entity_id: Some(customer.id.to_string()),
        },
        permission_keys: vec!["ViewCustomers".into()],
        score,
    })
}

fn map_supplier_result(query: &str, supplier: Supplier) -> Option<SearchResultDto> {
    let score = base_score(
        query,
        &supplier.code,
        &supplier.name,
        supplier.phone.as_deref(),
    )?;
    Some(SearchResultDto {
        id: format!("supplier:{}", supplier.id),
        result_type: "supplier".into(),
        title: supplier.name,
        subtitle: Some(supplier.code),
        icon: Some("Truck".into()),
        provider: "suppliers".into(),
        destination: SearchDestinationDto {
            route_id: "suppliers".into(),
            route_path: Some("/suppliers".into()),
            module_id: "parties".into(),
            entity_type: Some("supplier".into()),
            entity_id: Some(supplier.id.to_string()),
        },
        permission_keys: vec!["ViewSuppliers".into()],
        score,
    })
}

fn map_partner_result(query: &str, partner: Partner) -> Option<SearchResultDto> {
    let score = base_score(query, &partner.code, &partner.name, None)?;
    Some(SearchResultDto {
        id: format!("partner:{}", partner.id),
        result_type: "partner".into(),
        title: partner.name,
        subtitle: Some(partner.code),
        icon: Some("Users".into()),
        provider: "partners".into(),
        destination: SearchDestinationDto {
            route_id: "partners".into(),
            route_path: Some("/partners".into()),
            module_id: "parties".into(),
            entity_type: Some("partner".into()),
            entity_id: Some(partner.id.to_string()),
        },
        permission_keys: Vec::new(),
        score,
    })
}

fn map_material_result(query: &str, material: Material) -> Option<SearchResultDto> {
    let secondary_name = (!material.name_en.trim().is_empty()).then_some(material.name_en.as_str());
    let score =
        base_score(query, &material.code, &material.name, secondary_name).or_else(|| {
            (!material.barcode.trim().is_empty() && contains_query(query, &material.barcode))
                .then_some(95)
        })?;
    Some(SearchResultDto {
        id: format!("material:{}", material.id),
        result_type: "material".into(),
        title: material.name,
        subtitle: Some(if material.barcode.trim().is_empty() {
            material.code
        } else {
            format!("{} • {}", material.code, material.barcode)
        }),
        icon: Some("Package".into()),
        provider: "materials".into(),
        destination: SearchDestinationDto {
            route_id: "materials".into(),
            route_path: Some("/materials".into()),
            module_id: "inventory".into(),
            entity_type: Some("material".into()),
            entity_id: Some(material.id.to_string()),
        },
        permission_keys: vec!["ViewInventory".into()],
        score,
    })
}
