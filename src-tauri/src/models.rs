use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub model_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub message_id: Option<String>,
    pub ordinal: i64,
    pub kind: String,
    pub filename: String,
    pub mime: String,
    pub size: i64,
    pub has_file: bool,
    pub extracted_text: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub seq: i64,
    pub role: String,
    pub content: String,
    pub status: String,
    pub model_id: String,
    pub target_diagram_id: Option<String>,
    pub usage_json: Option<String>,
    pub error: Option<String>,
    pub created_at: i64,
    #[serde(default)]
    pub attachments: Vec<Attachment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagram {
    pub id: String,
    pub conversation_id: Option<String>,
    pub message_id: Option<String>,
    pub ordinal: i64,
    pub title: String,
    pub source: String,
    pub diagram_type: String,
    pub in_library: bool,
    pub favorite: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagramVersion {
    pub id: String,
    pub diagram_id: String,
    pub version_no: i64,
    pub source: String,
    pub origin: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagramInput {
    pub ordinal: i64,
    pub title: String,
    pub source: String,
    #[serde(default)]
    pub diagram_type: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendRequest {
    pub request_id: String,
    pub conversation_id: String,
    pub model_id: String,
    pub text: String,
    pub target_diagram_id: Option<String>,
    #[serde(default)]
    pub target_theme: Option<String>,
    #[serde(default)]
    pub attachment_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentImport {
    pub filename: String,
    pub mime: String,
    pub kind: String,
    #[serde(default)]
    pub text: String,
    pub data_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChatUsage {
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "event",
    content = "data"
)]
pub enum ChatEvent {
    Started {
        user_message_id: String,
        assistant_message_id: String,
    },
    Delta {
        text: String,
    },
    Done {
        message_id: String,
        content: String,
        usage: Option<ChatUsage>,
    },
    Error {
        message: String,
        partial: String,
    },
    Cancelled {
        message: String,
        partial: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_length: Option<i64>,
    pub prompt_price: f64,
    pub completion_price: f64,
    pub supports_vision: bool,
    pub supports_tools: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FreeModelQuota {
    pub used: i64,
    pub limit: i64,
    pub remaining: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct KeyInfo {
    pub label: String,
    pub usage: f64,
    pub limit: Option<f64>,
    pub limit_remaining: Option<f64>,
    pub is_free_tier: bool,
    pub free_model_daily_requests: Option<FreeModelQuota>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyStatus {
    pub configured: bool,
    pub masked: Option<String>,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeySaveResult {
    pub stored: bool,
    pub warning: Option<String>,
    pub info: KeyInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub data_dir: String,
    pub version: String,
}
