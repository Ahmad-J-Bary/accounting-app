use std::collections::HashMap;
use std::sync::Arc;

use crate::dto::search_dto::{SearchQueryRequest, SearchResultDto};
use crate::errors::AppError;
use crate::ports::search_provider::SearchProvider;

pub struct SearchUseCase {
    providers: Vec<Arc<dyn SearchProvider>>,
}

impl SearchUseCase {
    pub fn new(providers: Vec<Arc<dyn SearchProvider>>) -> Self {
        Self { providers }
    }

    pub async fn execute(
        &self,
        request: SearchQueryRequest,
    ) -> Result<Vec<SearchResultDto>, AppError> {
        let trimmed = request.query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }

        let mut merged: HashMap<String, SearchResultDto> = HashMap::new();
        for provider in &self.providers {
            for item in provider.search(&request).await? {
                if !is_result_allowed(&item, &request) {
                    continue;
                }
                match merged.get(&item.id) {
                    Some(existing) if existing.score >= item.score => {}
                    _ => {
                        merged.insert(item.id.clone(), item);
                    }
                }
            }
        }

        let mut results: Vec<SearchResultDto> = merged.into_values().collect();
        results.sort_by(|left, right| {
            right
                .score
                .cmp(&left.score)
                .then_with(|| left.title.cmp(&right.title))
        });

        let limit = request.limit.unwrap_or(20);
        if results.len() > limit {
            results.truncate(limit);
        }
        Ok(results)
    }
}

fn is_result_allowed(item: &SearchResultDto, request: &SearchQueryRequest) -> bool {
    if item.permission_keys.is_empty() {
        return true;
    }

    if request.context.has_permission("Admin") {
        return true;
    }

    item.permission_keys
        .iter()
        .all(|permission| request.context.has_permission(permission))
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use domain::shared::ExecutionContext;

    struct StaticProvider {
        id: &'static str,
        results: Vec<SearchResultDto>,
    }

    #[async_trait]
    impl SearchProvider for StaticProvider {
        fn provider_id(&self) -> &'static str {
            self.id
        }

        async fn search(
            &self,
            _request: &SearchQueryRequest,
        ) -> Result<Vec<SearchResultDto>, AppError> {
            Ok(self.results.clone())
        }
    }

    fn result(id: &str, score: i64) -> SearchResultDto {
        SearchResultDto {
            id: id.into(),
            result_type: "route".into(),
            title: id.into(),
            subtitle: None,
            icon: None,
            provider: "test".into(),
            destination: crate::dto::search_dto::SearchDestinationDto {
                route_id: "dashboard".into(),
                route_path: Some("/dashboard".into()),
                module_id: "main".into(),
                entity_type: None,
                entity_id: None,
            },
            permission_keys: Vec::new(),
            score,
        }
    }

    #[tokio::test]
    async fn merges_and_keeps_highest_scored_duplicate() {
        let use_case = SearchUseCase::new(vec![
            Arc::new(StaticProvider {
                id: "a",
                results: vec![result("dup", 10), result("other", 4)],
            }),
            Arc::new(StaticProvider {
                id: "b",
                results: vec![result("dup", 25)],
            }),
        ]);

        let items = use_case
            .execute(SearchQueryRequest {
                query: "dup".into(),
                limit: Some(10),
                entity_type: None,
                context: Default::default(),
            })
            .await
            .unwrap();

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, "dup");
        assert_eq!(items[0].score, 25);
    }

    #[tokio::test]
    async fn filters_out_results_without_required_permissions() {
        let use_case = SearchUseCase::new(vec![Arc::new(StaticProvider {
            id: "accounts",
            results: vec![SearchResultDto {
                id: "account:1".into(),
                result_type: "account".into(),
                title: "الصندوق".into(),
                subtitle: None,
                icon: None,
                provider: "accounts".into(),
                destination: crate::dto::search_dto::SearchDestinationDto {
                    route_id: "accounting-ledger".into(),
                    route_path: Some("/accounting/reports/ledger".into()),
                    module_id: "accounting".into(),
                    entity_type: Some("account".into()),
                    entity_id: Some("1".into()),
                },
                permission_keys: vec!["ViewAccounts".into()],
                score: 50,
            }],
        })]);

        let denied = use_case
            .execute(SearchQueryRequest {
                query: "الصندوق".into(),
                limit: Some(10),
                entity_type: None,
                context: ExecutionContext::default(),
            })
            .await
            .unwrap();
        assert!(denied.is_empty());

        let allowed = use_case
            .execute(SearchQueryRequest {
                query: "الصندوق".into(),
                limit: Some(10),
                entity_type: None,
                context: ExecutionContext {
                    permission_keys: vec!["ViewAccounts".into()],
                    ..ExecutionContext::default()
                },
            })
            .await
            .unwrap();
        assert_eq!(allowed.len(), 1);
    }
}
