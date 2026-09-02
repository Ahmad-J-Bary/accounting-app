use crate::dto::voice_dto::{VoiceCommandDto, VoiceIntentRequest, VoicePreviewDto};
use crate::errors::AppError;

pub struct PreviewVoiceIntentUseCase;

impl PreviewVoiceIntentUseCase {
    pub fn new() -> Self {
        Self
    }

    pub async fn execute(&self, request: VoiceIntentRequest) -> Result<VoicePreviewDto, AppError> {
        let transcript = request.transcript.trim();
        if transcript.is_empty() {
            return Err(AppError::Invalid("النص الصوتي فارغ".into()));
        }

        let normalized = transcript.to_lowercase();
        let candidates = if normalized.contains("الإعدادات") || normalized.contains("settings")
        {
            vec![VoiceCommandDto {
                action: "open_route".into(),
                route_id: Some("settings".into()),
                entity_type: None,
                entity_query: None,
                command_id: None,
                requires_confirmation: false,
            }]
        } else if normalized.contains("لوحة التحكم") || normalized.contains("dashboard") {
            vec![VoiceCommandDto {
                action: "open_route".into(),
                route_id: Some("dashboard".into()),
                entity_type: None,
                entity_query: None,
                command_id: None,
                requires_confirmation: false,
            }]
        } else if normalized.contains("العملاء") || normalized.contains("customers") {
            vec![VoiceCommandDto {
                action: "open_route".into(),
                route_id: Some("customers".into()),
                entity_type: None,
                entity_query: None,
                command_id: None,
                requires_confirmation: false,
            }]
        } else if normalized.contains("الموردين") || normalized.contains("suppliers") {
            vec![VoiceCommandDto {
                action: "open_route".into(),
                route_id: Some("suppliers".into()),
                entity_type: None,
                entity_query: None,
                command_id: None,
                requires_confirmation: false,
            }]
        } else if normalized.contains("ابحث") || normalized.starts_with("search ") {
            let query = transcript
                .replace("ابحث", "")
                .replace("search", "")
                .trim()
                .to_string();
            vec![VoiceCommandDto {
                action: "search".into(),
                route_id: None,
                entity_type: None,
                entity_query: Some(query),
                command_id: None,
                requires_confirmation: false,
            }]
        } else {
            vec![VoiceCommandDto {
                action: "search".into(),
                route_id: None,
                entity_type: None,
                entity_query: Some(transcript.to_string()),
                command_id: None,
                requires_confirmation: false,
            }]
        };

        Ok(VoicePreviewDto {
            state: if candidates.len() > 1 {
                "ambiguous".into()
            } else {
                "ready".into()
            },
            message: "تم تحليل الطلب الصوتي".into(),
            candidates,
        })
    }
}
