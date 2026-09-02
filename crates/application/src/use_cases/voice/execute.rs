use std::sync::Arc;

use crate::dto::search_dto::{SearchDestinationDto, SearchQueryRequest};
use crate::dto::voice_dto::{VoiceCommandDto, VoiceExecutionResultDto};
use crate::errors::AppError;
use crate::ports::search_provider::SearchProvider;
use crate::use_cases::search::SearchUseCase;
use domain::shared::ExecutionContext;

pub struct ExecuteVoiceCommandUseCase {
    search_use_case: SearchUseCase,
}

impl ExecuteVoiceCommandUseCase {
    pub fn new(search_providers: Vec<Arc<dyn SearchProvider>>) -> Self {
        Self {
            search_use_case: SearchUseCase::new(search_providers),
        }
    }

    pub async fn execute(
        &self,
        command: VoiceCommandDto,
        context: ExecutionContext,
    ) -> Result<VoiceExecutionResultDto, AppError> {
        match command.action.as_str() {
            "search" => {
                let query = command
                    .entity_query
                    .clone()
                    .ok_or_else(|| AppError::Invalid("أمر البحث يتطلب نصًا".into()))?;
                let results = self
                    .search_use_case
                    .execute(SearchQueryRequest {
                        query,
                        limit: Some(10),
                        entity_type: command.entity_type.clone(),
                        context,
                    })
                    .await?;
                Ok(VoiceExecutionResultDto {
                    state: if results.len() == 1 {
                        "success".into()
                    } else {
                        "ambiguous".into()
                    },
                    message: "تم تنفيذ البحث الصوتي".into(),
                    destination: results.first().map(|item| item.destination.clone()),
                    results,
                })
            }
            "open_route" => {
                let route_id = command
                    .route_id
                    .clone()
                    .ok_or_else(|| AppError::Invalid("أمر فتح الوجهة يتطلب route_id".into()))?;
                let route = route_destination_for(&route_id).ok_or_else(|| {
                    AppError::NotFound(format!("الوجهة الصوتية غير معروفة: {route_id}"))
                })?;
                if let Some(permission_key) = route.permission_key {
                    if !context.has_permission("Admin") && !context.has_permission(permission_key) {
                        return Err(AppError::Forbidden(format!(
                            "لا تملك صلاحية الوصول إلى الوجهة: {route_id}"
                        )));
                    }
                }
                Ok(VoiceExecutionResultDto {
                    state: "success".into(),
                    message: "تم تحديد الوجهة المطلوبة".into(),
                    destination: Some(SearchDestinationDto {
                        route_id: route_id.clone(),
                        route_path: Some(route.path.into()),
                        module_id: route.module_id.into(),
                        entity_type: None,
                        entity_id: None,
                    }),
                    results: Vec::new(),
                })
            }
            other => Err(AppError::Unsupported(format!(
                "أمر الصوت غير مدعوم بعد: {other}"
            ))),
        }
    }
}

struct RouteDestinationPolicy {
    path: &'static str,
    module_id: &'static str,
    permission_key: Option<&'static str>,
}

fn route_destination_for(route_id: &str) -> Option<RouteDestinationPolicy> {
    match route_id {
        "dashboard" => Some(RouteDestinationPolicy {
            path: "/dashboard",
            module_id: "main",
            permission_key: None,
        }),
        "settings" => Some(RouteDestinationPolicy {
            path: "/settings",
            module_id: "admin",
            permission_key: Some("ViewSettings"),
        }),
        "customers" => Some(RouteDestinationPolicy {
            path: "/customers",
            module_id: "parties",
            permission_key: Some("ViewCustomers"),
        }),
        "suppliers" => Some(RouteDestinationPolicy {
            path: "/suppliers",
            module_id: "parties",
            permission_key: Some("ViewSuppliers"),
        }),
        "partners" => Some(RouteDestinationPolicy {
            path: "/partners",
            module_id: "parties",
            permission_key: None,
        }),
        "materials" => Some(RouteDestinationPolicy {
            path: "/materials",
            module_id: "inventory",
            permission_key: Some("ViewInventory"),
        }),
        "journal" => Some(RouteDestinationPolicy {
            path: "/journal",
            module_id: "accounting",
            permission_key: Some("ViewJournal"),
        }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rejects_open_route_when_permission_is_missing() {
        let use_case = ExecuteVoiceCommandUseCase::new(Vec::new());
        let error = use_case
            .execute(
                VoiceCommandDto {
                    action: "open_route".into(),
                    route_id: Some("settings".into()),
                    entity_type: None,
                    entity_query: None,
                    command_id: None,
                    requires_confirmation: false,
                },
                ExecutionContext::default(),
            )
            .await
            .unwrap_err();

        assert!(matches!(error, AppError::Forbidden(_)));
    }

    #[tokio::test]
    async fn allows_open_route_when_permission_is_present() {
        let use_case = ExecuteVoiceCommandUseCase::new(Vec::new());
        let result = use_case
            .execute(
                VoiceCommandDto {
                    action: "open_route".into(),
                    route_id: Some("settings".into()),
                    entity_type: None,
                    entity_query: None,
                    command_id: None,
                    requires_confirmation: false,
                },
                ExecutionContext {
                    permission_keys: vec!["ViewSettings".into()],
                    ..ExecutionContext::default()
                },
            )
            .await
            .unwrap();

        assert_eq!(result.state, "success");
        assert_eq!(
            result.destination.and_then(|item| item.route_path),
            Some("/settings".into())
        );
    }
}
