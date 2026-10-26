use std::time::Duration;

use futures_util::StreamExt;
use serde_json::{json, Value};
use tauri::ipc::Channel;
use tokio_util::sync::CancellationToken;

use crate::models::{ChatEvent, ChatUsage, FreeModelQuota, KeyInfo, ModelInfo};

fn base_url() -> String {
    std::env::var("OPENROUTER_BASE_URL")
        .unwrap_or_else(|_| "https://openrouter.ai/api/v1".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn truncate(value: &str, max: usize) -> String {
    let mut out: String = value.chars().take(max).collect();
    if value.chars().count() > max {
        out.push('…');
    }
    out
}

fn http_error(status: reqwest::StatusCode, body: &str, retry_after: Option<&str>) -> String {
    match status.as_u16() {
        401 => "API key OpenRouter non valida (401). Controlla la key nelle impostazioni.".into(),
        402 => "Crediti OpenRouter insufficienti (402).".into(),
        403 => "Accesso negato da OpenRouter (403).".into(),
        404 => format!(
            "Modello o endpoint non trovato (404). Aggiorna il catalogo modelli. {}",
            truncate(body, 240)
        ),
        429 => {
            let wait = retry_after
                .map(|v| format!(" Riprova tra {v}."))
                .unwrap_or_default();
            format!("Rate limit OpenRouter (429).{wait}")
        }
        500..=599 => format!(
            "Errore temporaneo del provider ({}). Riprova. {}",
            status.as_u16(),
            truncate(body, 240)
        ),
        _ => format!(
            "OpenRouter ha risposto {}: {}",
            status.as_u16(),
            truncate(body, 500)
        ),
    }
}

fn parse_price(value: Option<&Value>) -> f64 {
    value
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0)
        * 1_000_000.0
}

fn parse_usage(value: &Value) -> Option<ChatUsage> {
    if value.is_null() {
        return None;
    }
    Some(ChatUsage {
        prompt_tokens: value
            .get("prompt_tokens")
            .and_then(|v| v.as_i64())
            .unwrap_or(0),
        completion_tokens: value
            .get("completion_tokens")
            .and_then(|v| v.as_i64())
            .unwrap_or(0),
        cost: value.get("cost").and_then(|v| v.as_f64()),
    })
}

pub async fn validate_key(client: &reqwest::Client, key: &str) -> Result<KeyInfo, String> {
    let response = client
        .get(format!("{}/key", base_url()))
        .bearer_auth(key)
        .header("X-OpenRouter-Title", "Mermaid Creator")
        .send()
        .await
        .map_err(|e| format!("Connessione a OpenRouter fallita: {e}"))?;
    let status = response.status();
    let retry_after = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .map(ToOwned::to_owned);
    let body = response
        .text()
        .await
        .map_err(|e| format!("Lettura risposta OpenRouter fallita: {e}"))?;
    if !status.is_success() {
        return Err(http_error(status, &body, retry_after.as_deref()));
    }
    let value: Value =
        serde_json::from_str(&body).map_err(|e| format!("Risposta /key non valida: {e}"))?;
    let data = value
        .get("data")
        .ok_or_else(|| "Risposta /key senza data".to_string())?;
    let free = data.get("free_model_daily_requests").and_then(|v| {
        if v.is_null() {
            None
        } else {
            Some(FreeModelQuota {
                used: v.get("used").and_then(|x| x.as_i64()).unwrap_or(0),
                limit: v.get("limit").and_then(|x| x.as_i64()).unwrap_or(0),
                remaining: v.get("remaining").and_then(|x| x.as_i64()).unwrap_or(0),
            })
        }
    });
    Ok(KeyInfo {
        label: data
            .get("label")
            .and_then(|v| v.as_str())
            .unwrap_or("OpenRouter key")
            .to_string(),
        usage: data.get("usage").and_then(|v| v.as_f64()).unwrap_or(0.0),
        limit: data.get("limit").and_then(|v| v.as_f64()),
        limit_remaining: data.get("limit_remaining").and_then(|v| v.as_f64()),
        is_free_tier: data
            .get("is_free_tier")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        free_model_daily_requests: free,
    })
}

pub async fn fetch_models(client: &reqwest::Client) -> Result<Vec<ModelInfo>, String> {
    let response = client
        .get(format!("{}/models?limit=1000", base_url()))
        .header("X-OpenRouter-Title", "Mermaid Creator")
        .send()
        .await
        .map_err(|e| format!("Connessione a OpenRouter fallita: {e}"))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Lettura catalogo fallita: {e}"))?;
    if !status.is_success() {
        return Err(http_error(status, &body, None));
    }
    let value: Value =
        serde_json::from_str(&body).map_err(|e| format!("Catalogo modelli non valido: {e}"))?;
    let data = value
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Catalogo modelli senza data".to_string())?;

    let mut models = Vec::with_capacity(data.len());
    for model in data {
        let Some(id) = model.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        let architecture = model.get("architecture");
        let modalities = architecture
            .and_then(|a| a.get("input_modalities"))
            .and_then(|v| v.as_array());
        let supports_vision = modalities
            .map(|items| items.iter().any(|v| v.as_str() == Some("image")))
            .unwrap_or(false);
        let supported = model.get("supported_parameters").and_then(|v| v.as_array());
        let supports_tools = supported
            .map(|items| items.iter().any(|v| v.as_str() == Some("tools")))
            .unwrap_or(false);
        let pricing = model.get("pricing");
        models.push(ModelInfo {
            id: id.to_string(),
            name: model
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(id)
                .to_string(),
            context_length: model
                .get("context_length")
                .and_then(|v| v.as_i64())
                .or_else(|| {
                    model
                        .get("top_provider")
                        .and_then(|p| p.get("context_length"))
                        .and_then(|v| v.as_i64())
                }),
            prompt_price: parse_price(pricing.and_then(|p| p.get("prompt"))),
            completion_price: parse_price(pricing.and_then(|p| p.get("completion"))),
            supports_vision,
            supports_tools,
            description: model
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        });
    }
    Ok(models)
}

pub struct StreamOutcome {
    pub content: String,
    pub usage: Option<ChatUsage>,
}

pub struct StreamFailure {
    pub message: String,
    pub partial: String,
    pub cancelled: bool,
    pub usage: Option<ChatUsage>,
}

impl StreamFailure {
    fn new(message: impl Into<String>, partial: impl Into<String>, cancelled: bool) -> Self {
        Self {
            message: message.into(),
            partial: partial.into(),
            cancelled,
            usage: None,
        }
    }

    fn with_usage(mut self, usage: Option<ChatUsage>) -> Self {
        self.usage = usage;
        self
    }
}

/// Chiamata non-streaming usata dal planner. Accetta una cancellazione e un
/// timeout, e restituisce il JSON contenuto nella risposta.
pub async fn complete_json(
    client: &reqwest::Client,
    key: &str,
    model: &str,
    messages: Vec<Value>,
    max_tokens: u32,
    cancel: &CancellationToken,
) -> Result<(Value, Option<ChatUsage>), String> {
    let (content, usage) = complete_text(client, key, model, messages, max_tokens, cancel).await?;
    Ok((parse_json_content(&content)?, usage))
}

/// Chiamata non-streaming generica. Usata dal planner e dal correttore Mermaid.
pub async fn complete_text(
    client: &reqwest::Client,
    key: &str,
    model: &str,
    messages: Vec<Value>,
    max_tokens: u32,
    cancel: &CancellationToken,
) -> Result<(String, Option<ChatUsage>), String> {
    let body = json!({
        "model": model,
        "messages": messages,
        "stream": false,
        "temperature": 0,
        "max_tokens": max_tokens
    });
    let request = client
        .post(format!("{}/chat/completions", base_url()))
        .bearer_auth(key)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://localhost/mermaid-creator")
        .header("X-OpenRouter-Title", "Mermaid Creator")
        .json(&body)
        .send();
    let response = tokio::select! {
        _ = cancel.cancelled() => return Err("Pianificazione annullata".into()),
        result = tokio::time::timeout(Duration::from_secs(30), request) => {
            result
                .map_err(|_| "Timeout della chiamata (30s).".to_string())?
                .map_err(|e| format!("Connessione a OpenRouter fallita: {e}"))?
        }
    };
    let status = response.status();
    let retry_after = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned);
    let body = tokio::select! {
        _ = cancel.cancelled() => return Err("Pianificazione annullata".into()),
        result = tokio::time::timeout(Duration::from_secs(30), response.text()) => {
            result
                .map_err(|_| "Timeout della chiamata (30s).".to_string())?
                .map_err(|e| format!("Lettura risposta fallita: {e}"))?
        }
    };
    if !status.is_success() {
        return Err(http_error(status, &body, retry_after.as_deref()));
    }
    let value: Value =
        serde_json::from_str(&body).map_err(|e| format!("Risposta non valida: {e}"))?;
    let usage = value.get("usage").and_then(parse_usage);
    let message = value
        .get("choices")
        .and_then(|value| value.as_array())
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .ok_or_else(|| "Il modello non ha restituito un messaggio.".to_string())?;
    let content = message
        .get("content")
        .and_then(|content| content.as_str())
        .filter(|content| !content.trim().is_empty())
        .or_else(|| message.get("reasoning").and_then(|value| value.as_str()))
        .ok_or_else(|| "Il modello non ha restituito testo.".to_string())?;
    Ok((content.trim().to_string(), usage))
}

fn parse_json_content(content: &str) -> Result<Value, String> {
    let mut text = content.trim();
    if text.starts_with("```") {
        text = text
            .strip_prefix("```json")
            .or_else(|| text.strip_prefix("```JSON"))
            .or_else(|| text.strip_prefix("```"))
            .unwrap_or(text);
        if let Some(end) = text.rfind("```") {
            text = &text[..end];
        }
    }
    let start = text.find('{').ok_or_else(|| "JSON del planner assente".to_string())?;
    let end = text.rfind('}').ok_or_else(|| "JSON del planner incompleto".to_string())?;
    if end < start {
        return Err("JSON del planner incompleto".into());
    }
    serde_json::from_str(&text[start..=end])
        .map_err(|e| format!("JSON del planner non valido: {e}; contenuto: {}", truncate(text, 240)))
}

pub async fn stream_chat(
    client: &reqwest::Client,
    key: &str,
    model: &str,
    messages: Vec<Value>,
    on_event: &Channel<ChatEvent>,
    cancel: &CancellationToken,
) -> Result<StreamOutcome, StreamFailure> {
    let body = json!({
        "model": model,
        "messages": messages,
        "stream": true
    });

    let request = client
        .post(format!("{}/chat/completions", base_url()))
        .bearer_auth(key)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://localhost/mermaid-creator")
        .header("X-OpenRouter-Title", "Mermaid Creator")
        .json(&body)
        .send();
    let response = tokio::select! {
        _ = cancel.cancelled() => {
            return Err(StreamFailure::new("Generazione annullata", String::new(), true));
        }
        result = tokio::time::timeout(Duration::from_secs(30), request) => {
            match result {
                Err(_) => {
                    return Err(StreamFailure::new(
                        "Timeout durante l'invio a OpenRouter (30s).",
                        String::new(),
                        false,
                    ));
                }
                Ok(Err(e)) => {
                    return Err(StreamFailure::new(
                        format!("Connessione a OpenRouter fallita: {e}"),
                        String::new(),
                        false,
                    ));
                }
                Ok(Ok(response)) => response,
            }
        }
    };

    let status = response.status();
    if !status.is_success() {
        let retry_after = response
            .headers()
            .get(reqwest::header::RETRY_AFTER)
            .and_then(|v| v.to_str().ok())
            .map(ToOwned::to_owned);
        let body = tokio::select! {
            _ = cancel.cancelled() => {
                return Err(StreamFailure::new("Generazione annullata", String::new(), true));
            }
            result = response.text() => {
                result.unwrap_or_else(|_| "corpo non leggibile".to_string())
            }
        };
        return Err(StreamFailure::new(
            http_error(status, &body, retry_after.as_deref()),
            String::new(),
            false,
        ));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut content = String::new();
    let mut usage: Option<ChatUsage> = None;
    let mut done = false;

    while !done {
        if cancel.is_cancelled() {
            return Err(StreamFailure::new("Generazione annullata", content, true).with_usage(usage.clone()));
        }

        let next = tokio::select! {
            _ = cancel.cancelled() => {
                return Err(StreamFailure::new(
                    "Generazione annullata",
                    content,
                    true,
                ).with_usage(usage.clone()));
            }
            result = tokio::time::timeout(Duration::from_secs(90), stream.next()) => result,
        };
        let chunk = match next {
            Err(_) => {
                return Err(StreamFailure::new(
                    "Timeout: il provider non ha inviato dati per 90 secondi.",
                    content,
                    false,
                ).with_usage(usage.clone()))
            }
            Ok(None) => break,
            Ok(Some(Err(e))) => {
                return Err(StreamFailure::new(
                    format!("Errore durante lo streaming: {e}"),
                    content,
                    false,
                ).with_usage(usage.clone()))
            }
            Ok(Some(Ok(chunk))) => chunk,
        };

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(position) = buffer.find('\n') {
            let line = buffer[..position].trim_end_matches('\r').to_string();
            buffer.drain(..=position);
            if line.is_empty() || line.starts_with(':') {
                continue;
            }
            let Some(data) = line.strip_prefix("data:") else {
                continue;
            };
            let data = data.trim();
            if data.is_empty() {
                continue;
            }
            if data == "[DONE]" {
                done = true;
                break;
            }
            let Ok(value) = serde_json::from_str::<Value>(data) else {
                continue;
            };
            if let Some(error) = value.get("error") {
                let message = error
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("errore sconosciuto");
                return Err(StreamFailure::new(
                    format!("OpenRouter: {}", truncate(message, 500)),
                    content,
                    false,
                ).with_usage(usage.clone()));
            }
            if let Some(parsed_usage) = value.get("usage").and_then(parse_usage) {
                usage = Some(parsed_usage);
            }
            if let Some(choice) = value
                .get("choices")
                .and_then(|v| v.as_array())
                .and_then(|v| v.first())
            {
                if let Some(text) = choice
                    .get("delta")
                    .and_then(|d| d.get("content"))
                    .and_then(|c| c.as_str())
                {
                    if !text.is_empty() {
                        content.push_str(text);
                        if on_event
                            .send(ChatEvent::Delta {
                                text: text.to_string(),
                            })
                            .is_err()
                        {
                            return Err(StreamFailure::new(
                                "Finestra chiusa durante lo streaming",
                                content,
                                true,
                            ).with_usage(usage.clone()));
                        }
                    }
                }
            }
        }
    }

    if content.is_empty() {
        return Err(StreamFailure::new(
            "Il modello non ha restituito testo.",
            content,
            false,
        ).with_usage(usage.clone()));
    }

    Ok(StreamOutcome { content, usage })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_plain_and_fenced_json() {
        let plain = parse_json_content(r#"{"research":true,"queries":["x"]}"#).unwrap();
        assert_eq!(plain["research"], true);
        let fenced = parse_json_content("```json\n{\"research\":false}\n```").unwrap();
        assert_eq!(fenced["research"], false);
        let wrapped = parse_json_content("ecco il piano: {\"research\":true} fine").unwrap();
        assert_eq!(wrapped["research"], true);
    }

    #[test]
    fn rejects_missing_json() {
        assert!(parse_json_content("nessun json").is_err());
        assert!(parse_json_content("{incompleto").is_err());
    }
}
