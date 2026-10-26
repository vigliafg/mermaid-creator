use std::collections::HashMap;
use std::net::IpAddr;
use std::time::Duration;

use futures_util::future::join_all;
use futures_util::StreamExt;
use reqwest::redirect::Policy;
use reqwest::{Client, Url};
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio_util::sync::CancellationToken;

const USER_AGENT: &str = concat!(
    "MermaidCreator/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/vigliafg/mermaid-creator)"
);
const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;
const MAX_SOURCE_CHARS: usize = 2_500;
const MAX_TOTAL_CHARS: usize = 12_000;
const MAX_SOURCES: usize = 8;
const MAX_QUERIES: usize = 3;
const MAX_URLS: usize = 2;
const REQUEST_TIMEOUT_SECS: u64 = 8;
const COLLECT_TIMEOUT_SECS: u64 = 20;
const MAX_REDIRECTS: usize = 5;
const MAX_EXTRACT_CHARS: usize = 6_000;

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ResearchPlan {
    #[serde(default)]
    pub research: bool,
    #[serde(default)]
    pub reason: String,
    #[serde(default)]
    pub queries: Vec<String>,
    #[serde(default)]
    pub urls: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResearchSource {
    pub id: String,
    pub provider: String,
    pub title: String,
    pub url: String,
    pub text: String,
    pub published: Option<String>,
    pub retrieved_at: String,
}

#[derive(Debug, Default)]
pub struct ResearchOutcome {
    pub sources: Vec<ResearchSource>,
}

struct FetchedPage {
    body: String,
    content_type: String,
}

struct ValidatedUrl {
    url: Url,
    host: Option<String>,
    ip: IpAddr,
    port: u16,
}

pub fn build_client() -> Client {
    Client::builder()
        .no_proxy()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .user_agent(USER_AGENT)
        .build()
        .unwrap_or_else(|_| Client::new())
}

pub async fn collect(
    client: &Client,
    plan: &ResearchPlan,
    cancel: &CancellationToken,
    retrieved_at: &str,
) -> ResearchOutcome {
    let queries: Vec<String> = plan
        .queries
        .iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .take(MAX_QUERIES)
        .collect();
    let urls: Vec<String> = plan
        .urls
        .iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .take(MAX_URLS)
        .collect();

    let work = async {
        let mut sources = Vec::new();
        let query_results = join_all(
            queries
                .iter()
                .map(|query| search_query(client, query, cancel)),
        )
        .await;
        for mut found in query_results {
            sources.append(&mut found);
        }
        let url_results = join_all(
            urls.iter()
                .map(|url| fetch_url_source(client, url, cancel, retrieved_at)),
        )
        .await;
        for source in url_results.into_iter().flatten() {
            sources.push(source);
        }
        sources
    };

    let sources = tokio::select! {
        _ = cancel.cancelled() => Vec::new(),
        result = tokio::time::timeout(Duration::from_secs(COLLECT_TIMEOUT_SECS), work) => {
            match result {
                Ok(sources) => sources,
                Err(_) => {
                    eprintln!("ricerca: timeout complessivo");
                    Vec::new()
                }
            }
        }
    };

    ResearchOutcome {
        sources: rank_and_limit(sources, retrieved_at),
    }
}

async fn search_query(
    client: &Client,
    query: &str,
    cancel: &CancellationToken,
) -> Vec<ResearchSource> {
    let (wikipedia, wikidata, openalex, bing) = tokio::join!(
        search_wikipedia(client, query, cancel),
        search_wikidata(client, query, cancel),
        search_openalex(client, query, cancel),
        search_bing(client, query, cancel),
    );
    let mut out = Vec::new();
    out.extend(wikipedia);
    out.extend(openalex);
    out.extend(wikidata);
    out.extend(bing);
    out
}

async fn get_json(
    client: &Client,
    url: Url,
    cancel: &CancellationToken,
) -> Result<Value, String> {
    let page = fetch_public_text(client, url.as_str(), cancel).await?;
    serde_json::from_str(&page.body).map_err(|e| format!("JSON non valido: {e}"))
}

async fn search_wikipedia(
    client: &Client,
    query: &str,
    cancel: &CancellationToken,
) -> Vec<ResearchSource> {
    let mut sources = Vec::new();
    for lang in ["it", "en"] {
        if cancel.is_cancelled() {
            break;
        }
        let search_url = match Url::parse_with_params(
            &format!("https://{lang}.wikipedia.org/w/api.php"),
            &[
                ("action", "query"),
                ("list", "search"),
                ("srsearch", query),
                ("srlimit", "3"),
                ("format", "json"),
                ("utf8", "1"),
            ],
        ) {
            Ok(url) => url,
            Err(_) => continue,
        };
        let search = match get_json(client, search_url, cancel).await {
            Ok(value) => value,
            Err(_) => continue,
        };
        let titles: Vec<String> = search
            .get("query")
            .and_then(|value| value.get("search"))
            .and_then(|value| value.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.get("title").and_then(|value| value.as_str()))
                    .map(ToOwned::to_owned)
                    .collect()
            })
            .unwrap_or_default();
        if titles.is_empty() {
            continue;
        }
        let extract_url = match Url::parse_with_params(
            &format!("https://{lang}.wikipedia.org/w/api.php"),
            &[
                ("action", "query"),
                ("prop", "info|extracts"),
                ("explaintext", "1"),
                ("exintro", "1"),
                ("redirects", "1"),
                ("inprop", "url"),
                ("format", "json"),
                ("titles", &titles.join("|")),
            ],
        ) {
            Ok(url) => url,
            Err(_) => continue,
        };
        let extracts = match get_json(client, extract_url, cancel).await {
            Ok(value) => value,
            Err(_) => continue,
        };
        let Some(pages) = extracts
            .get("query")
            .and_then(|value| value.get("pages"))
            .and_then(|value| value.as_object())
        else {
            continue;
        };
        for page in pages.values() {
            let title = page
                .get("title")
                .and_then(|value| value.as_str())
                .unwrap_or(query)
                .to_string();
            let text = page
                .get("extract")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            if text.trim().is_empty() {
                continue;
            }
            let url = page
                .get("fullurl")
                .and_then(|value| value.as_str())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| format!("https://{lang}.wikipedia.org/wiki/{}", title.replace(' ', "_")));
            sources.push(ResearchSource {
                id: String::new(),
                provider: "Wikipedia".into(),
                title,
                url,
                text: truncate_text(text, MAX_SOURCE_CHARS),
                published: None,
                retrieved_at: String::new(),
            });
        }
    }
    sources
}

async fn search_wikidata(
    client: &Client,
    query: &str,
    cancel: &CancellationToken,
) -> Vec<ResearchSource> {
    let mut entity_id = None;
    for lang in ["it", "en"] {
        let url = match Url::parse_with_params(
            "https://www.wikidata.org/w/api.php",
            &[
                ("action", "wbsearchentities"),
                ("search", query),
                ("language", lang),
                ("uselang", lang),
                ("limit", "2"),
                ("format", "json"),
            ],
        ) {
            Ok(url) => url,
            Err(_) => continue,
        };
        let value = match get_json(client, url, cancel).await {
            Ok(value) => value,
            Err(_) => continue,
        };
        if let Some(id) = value
            .get("search")
            .and_then(|value| value.as_array())
            .and_then(|items| items.first())
            .and_then(|item| item.get("id"))
            .and_then(|value| value.as_str())
        {
            entity_id = Some(id.to_string());
            break;
        }
    }
    let Some(entity_id) = entity_id else {
        return Vec::new();
    };
    let url = match Url::parse_with_params(
        "https://www.wikidata.org/w/api.php",
        &[
            ("action", "wbgetentities"),
            ("ids", &entity_id),
            ("props", "labels|descriptions|claims"),
            ("languages", "it|en"),
            ("format", "json"),
        ],
    ) {
        Ok(url) => url,
        Err(_) => return Vec::new(),
    };
    let value = match get_json(client, url, cancel).await {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };
    let Some(entity) = value
        .get("entities")
        .and_then(|value| value.get(&entity_id))
    else {
        return Vec::new();
    };
    let label = localized_value(entity.get("labels")).unwrap_or_else(|| entity_id.clone());
    let description = localized_value(entity.get("descriptions")).unwrap_or_default();
    let claim_values = collect_claims(entity);
    let mut qids: Vec<String> = claim_values
        .iter()
        .flat_map(|(_, values)| values.iter())
        .filter(|value| value.starts_with('Q'))
        .cloned()
        .collect();
    qids.sort();
    qids.dedup();
    let labels = if qids.is_empty() {
        HashMap::new()
    } else {
        labels_for_qids(client, &qids, cancel).await
    };
    let mut text = String::new();
    if !label.is_empty() {
        text.push_str(&format!("Entità: {label}\n"));
    }
    if !description.is_empty() {
        text.push_str(&format!("Descrizione: {description}\n"));
    }
    for (property, values) in claim_values.iter().take(12) {
        let rendered: Vec<String> = values
            .iter()
            .map(|value| labels.get(value).cloned().unwrap_or_else(|| value.clone()))
            .collect();
        if !rendered.is_empty() {
            text.push_str(&format!("{}: {}\n", property, rendered.join(", ")));
        }
    }
    if text.trim().is_empty() {
        return Vec::new();
    }
    vec![ResearchSource {
        id: String::new(),
        provider: "Wikidata".into(),
        title: label,
        url: format!("https://www.wikidata.org/wiki/{entity_id}"),
        text: truncate_text(&text, MAX_SOURCE_CHARS),
        published: None,
        retrieved_at: String::new(),
    }]
}

fn localized_value(value: Option<&Value>) -> Option<String> {
    let object = value?.as_object()?;
    for lang in ["it", "en"] {
        if let Some(text) = object
            .get(lang)
            .and_then(|entry| entry.get("value"))
            .and_then(|entry| entry.as_str())
        {
            if !text.trim().is_empty() {
                return Some(text.to_string());
            }
        }
    }
    object
        .values()
        .find_map(|entry| entry.get("value").and_then(|value| value.as_str()))
        .map(ToOwned::to_owned)
}

fn collect_claims(entity: &Value) -> Vec<(String, Vec<String>)> {
    const PROPS: &[(&str, &str)] = &[
        ("P31", "istanza di"),
        ("P279", "sottoclasse di"),
        ("P361", "parte di"),
        ("P527", "ha parte"),
        ("P17", "paese"),
        ("P571", "inizio"),
        ("P50", "autore"),
        ("P69", "formazione"),
        ("P108", "datore di lavoro"),
        ("P106", "occupazione"),
    ];
    let mut out = Vec::new();
    for (prop, label) in PROPS {
        let Some(claims) = entity
            .get("claims")
            .and_then(|value| value.get(prop))
            .and_then(|value| value.as_array())
        else {
            continue;
        };
        let mut values = Vec::new();
        for claim in claims {
            let Some(value) = claim
                .get("mainsnak")
                .and_then(|value| value.get("datavalue"))
                .and_then(|value| value.get("value"))
            else {
                continue;
            };
            if let Some(id) = value.get("id").and_then(|value| value.as_str()) {
                values.push(id.to_string());
            } else if let Some(text) = value.as_str() {
                values.push(text.to_string());
            } else if let Some(time) = value.get("time").and_then(|value| value.as_str()) {
                values.push(time.to_string());
            }
        }
        if !values.is_empty() {
            out.push((label.to_string(), values));
        }
    }
    out
}

async fn labels_for_qids(
    client: &Client,
    qids: &[String],
    cancel: &CancellationToken,
) -> HashMap<String, String> {
    let ids = qids.iter().take(25).cloned().collect::<Vec<_>>().join("|");
    let url = match Url::parse_with_params(
        "https://www.wikidata.org/w/api.php",
        &[
            ("action", "wbgetentities"),
            ("ids", &ids),
            ("props", "labels"),
            ("languages", "it|en"),
            ("format", "json"),
        ],
    ) {
        Ok(url) => url,
        Err(_) => return HashMap::new(),
    };
    let Ok(value) = get_json(client, url, cancel).await else {
        return HashMap::new();
    };
    let mut labels = HashMap::new();
    if let Some(entities) = value.get("entities").and_then(|value| value.as_object()) {
        for (id, entity) in entities {
            if let Some(label) = localized_value(entity.get("labels")) {
                labels.insert(id.clone(), label);
            }
        }
    }
    labels
}

async fn search_openalex(
    client: &Client,
    query: &str,
    cancel: &CancellationToken,
) -> Vec<ResearchSource> {
    let url = match Url::parse_with_params(
        "https://api.openalex.org/works",
        &[
            ("search", query),
            ("per-page", "3"),
            (
                "select",
                "id,display_name,publication_year,doi,primary_location,authorships,abstract_inverted_index",
            ),
        ],
    ) {
        Ok(url) => url,
        Err(_) => return Vec::new(),
    };
    let Ok(value) = get_json(client, url, cancel).await else {
        return Vec::new();
    };
    let Some(results) = value.get("results").and_then(|value| value.as_array()) else {
        return Vec::new();
    };
    let mut sources = Vec::new();
    for work in results {
        let title = work
            .get("display_name")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        if title.trim().is_empty() {
            continue;
        }
        let year = work
            .get("publication_year")
            .and_then(|value| value.as_i64())
            .map(|value| value.to_string());
        let doi = work.get("doi").and_then(|value| value.as_str());
        let landing = work
            .get("primary_location")
            .and_then(|value| value.get("landing_page_url"))
            .and_then(|value| value.as_str());
        let url = doi
            .map(ToOwned::to_owned)
            .or_else(|| landing.map(ToOwned::to_owned))
            .or_else(|| work.get("id").and_then(|value| value.as_str()).map(ToOwned::to_owned))
            .unwrap_or_default();
        if url.is_empty() {
            continue;
        }
        let authors = work
            .get("authorships")
            .and_then(|value| value.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        item.get("author")
                            .and_then(|author| author.get("display_name"))
                            .and_then(|value| value.as_str())
                    })
                    .take(8)
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default();
        let abstract_text = work
            .get("abstract_inverted_index")
            .map(reconstruct_abstract)
            .unwrap_or_default();
        let mut text = format!("{title}");
        if let Some(year) = &year {
            text.push_str(&format!("\nAnno: {year}"));
        }
        if !authors.is_empty() {
            text.push_str(&format!("\nAutori: {authors}"));
        }
        if !abstract_text.is_empty() {
            text.push_str(&format!("\nAbstract: {abstract_text}"));
        }
        sources.push(ResearchSource {
            id: String::new(),
            provider: "OpenAlex".into(),
            title: title.to_string(),
            url,
            text: truncate_text(&text, MAX_SOURCE_CHARS),
            published: year,
            retrieved_at: String::new(),
        });
    }
    sources
}

fn reconstruct_abstract(value: &Value) -> String {
    let Some(index) = value.as_object() else {
        return String::new();
    };
    let mut words: Vec<(i64, String)> = Vec::new();
    for (word, positions) in index {
        if let Some(positions) = positions.as_array() {
            for position in positions {
                if let Some(position) = position.as_i64() {
                    words.push((position, word.clone()));
                }
            }
        }
    }
    words.sort_by_key(|(position, _)| *position);
    words
        .into_iter()
        .map(|(_, word)| word)
        .collect::<Vec<_>>()
        .join(" ")
}

async fn search_bing(
    client: &Client,
    query: &str,
    cancel: &CancellationToken,
) -> Vec<ResearchSource> {
    let url = match Url::parse_with_params(
        "https://www.bing.com/search",
        &[("q", query), ("format", "rss"), ("setlang", "it")],
    ) {
        Ok(url) => url,
        Err(_) => return Vec::new(),
    };
    let Ok(page) = fetch_public_text(client, url.as_str(), cancel).await else {
        return Vec::new();
    };
    let mut sources = parse_bing_rss(&page.body);
    for source in sources.iter_mut().take(2) {
        if cancel.is_cancelled() {
            break;
        }
        if let Ok((title, text)) = fetch_page_data(client, &source.url, cancel).await {
            if !title.is_empty() {
                source.title = title;
            }
            if text.len() > source.text.len() {
                source.text = truncate_text(&text, MAX_SOURCE_CHARS);
            }
        }
    }
    sources
}

fn parse_bing_rss(xml: &str) -> Vec<ResearchSource> {
    let Ok(document) = roxmltree::Document::parse(xml) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for item in document
        .descendants()
        .filter(|node| node.is_element() && node.tag_name().name() == "item")
        .take(10)
    {
        let title = child_text(item, "title");
        let link = child_text(item, "link");
        let description = child_text(item, "description");
        if title.is_empty() || link.is_empty() {
            continue;
        }
        out.push(ResearchSource {
            id: String::new(),
            provider: "Bing".into(),
            title,
            url: link,
            text: truncate_text(&description, MAX_SOURCE_CHARS),
            published: Some(child_text(item, "pubDate")).filter(|value| !value.is_empty()),
            retrieved_at: String::new(),
        });
    }
    out
}

fn child_text(node: roxmltree::Node<'_, '_>, name: &str) -> String {
    node.children()
        .find(|child| child.is_element() && child.tag_name().name() == name)
        .and_then(|child| child.text())
        .unwrap_or("")
        .trim()
        .to_string()
}

async fn fetch_url_source(
    client: &Client,
    url: &str,
    cancel: &CancellationToken,
    retrieved_at: &str,
) -> Result<ResearchSource, String> {
    let (title, text) = fetch_page_data(client, url, cancel).await?;
    Ok(ResearchSource {
        id: String::new(),
        provider: "Web".into(),
        title: if title.is_empty() {
            url.to_string()
        } else {
            title
        },
        url: url.to_string(),
        text: truncate_text(&text, MAX_SOURCE_CHARS),
        published: None,
        retrieved_at: retrieved_at.to_string(),
    })
}

async fn fetch_page_data(
    client: &Client,
    url: &str,
    cancel: &CancellationToken,
) -> Result<(String, String), String> {
    let page = fetch_public_text(client, url, cancel).await?;
    let content_type = page.content_type.to_ascii_lowercase();
    if content_type.contains("html") || content_type.contains("xml") {
        let (title, text) = extract_html(&page.body);
        Ok((title, text))
    } else {
        Ok((String::new(), truncate_text(page.body.trim(), MAX_EXTRACT_CHARS)))
    }
}

fn extract_html(html: &str) -> (String, String) {
    let document = Html::parse_document(html);
    let title = Selector::parse("title")
        .ok()
        .and_then(|selector| document.select(&selector).next())
        .map(|element| normalize_ws(&element.text().collect::<Vec<_>>().join(" ")))
        .unwrap_or_default();
    let selector = Selector::parse("h1, h2, h3, p, li, td, th").ok();
    let mut parts = Vec::new();
    if let Some(selector) = selector {
        for element in document.select(&selector) {
            let text = normalize_ws(&element.text().collect::<Vec<_>>().join(" "));
            if !text.is_empty() {
                parts.push(text);
            }
        }
    }
    let mut text = parts.join("\n");
    if text.is_empty() {
        if let Ok(selector) = Selector::parse("body") {
            if let Some(body) = document.select(&selector).next() {
                text = normalize_ws(&body.text().collect::<Vec<_>>().join(" "));
            }
        }
    }
    (title, truncate_text(&text, MAX_EXTRACT_CHARS))
}

fn normalize_ws(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate_text(value: &str, max: usize) -> String {
    let mut out: String = value.chars().take(max).collect();
    if value.chars().count() > max {
        out.push('…');
    }
    out
}

fn rank_and_limit(sources: Vec<ResearchSource>, retrieved_at: &str) -> Vec<ResearchSource> {
    let mut unique: HashMap<String, ResearchSource> = HashMap::new();
    for source in sources {
        let key = canonical_url(&source.url);
        match unique.get(&key) {
            Some(existing) => {
                let source_rank = provider_rank(&source.provider);
                let existing_rank = provider_rank(&existing.provider);
                if source_rank < existing_rank
                    || (source_rank == existing_rank && source.text.len() > existing.text.len())
                {
                    unique.insert(key, source);
                }
            }
            None => {
                unique.insert(key, source);
            }
        }
    }
    let mut list: Vec<ResearchSource> = unique.into_values().collect();
    list.sort_by(|a, b| {
        provider_rank(&a.provider)
            .cmp(&provider_rank(&b.provider))
            .then_with(|| b.text.len().cmp(&a.text.len()))
    });
    let mut total = 0usize;
    let mut out = Vec::new();
    for mut source in list {
        if out.len() >= MAX_SOURCES || total >= MAX_TOTAL_CHARS {
            break;
        }
        let remaining = MAX_TOTAL_CHARS.saturating_sub(total);
        source.text = truncate_text(&source.text, remaining.min(MAX_SOURCE_CHARS));
        total += source.text.chars().count();
        source.id = format!("S{}", out.len() + 1);
        source.retrieved_at = if retrieved_at.is_empty() {
            "data non disponibile".to_string()
        } else {
            retrieved_at.to_string()
        };
        out.push(source);
    }
    out
}

fn provider_rank(provider: &str) -> u8 {
    match provider {
        "Web" => 0,
        "Wikipedia" => 1,
        "OpenAlex" => 2,
        "Wikidata" => 3,
        "Bing" => 4,
        _ => 5,
    }
}

fn canonical_url(raw: &str) -> String {
    Url::parse(raw)
        .map(|mut url| {
            url.set_fragment(None);
            url.to_string()
        })
        .unwrap_or_else(|_| raw.trim().to_lowercase())
}

async fn fetch_public_text(
    _client: &Client,
    raw_url: &str,
    cancel: &CancellationToken,
) -> Result<FetchedPage, String> {
    let mut current = validate_url(raw_url).await?;
    for _ in 0..=MAX_REDIRECTS {
        let mut builder = Client::builder()
            .no_proxy()
            .redirect(Policy::none())
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .user_agent(USER_AGENT);
        if let Some(host) = &current.host {
            builder = builder.resolve(host, std::net::SocketAddr::new(current.ip, current.port));
        }
        let request = builder
            .build()
            .map_err(|e| format!("Client di ricerca non disponibile: {e}"))?
            .get(current.url.clone())
            .send();
        let response = tokio::select! {
            _ = cancel.cancelled() => return Err("Ricerca annullata".into()),
            result = request => result.map_err(|e| format!("Fetch fallito: {e}"))?,
        };
        let status = response.status();
        if status.is_redirection() {
            let Some(location) = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|value| value.to_str().ok())
            else {
                return Err("Redirect senza Location".into());
            };
            let next = current
                .url
                .join(location)
                .map_err(|e| format!("Redirect non valido: {e}"))?;
            current = validate_url(next.as_str()).await?;
            continue;
        }
        if !status.is_success() {
            return Err(format!("Il server ha risposto {}", status.as_u16()));
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("text/html")
            .to_ascii_lowercase();
        if !allowed_content_type(&content_type) {
            return Err(format!("Content-Type non supportato: {content_type}"));
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_BODY_BYTES as u64)
        {
            return Err("Risposta troppo grande".into());
        }
        let body = read_limited_body(response, cancel).await?;
        return Ok(FetchedPage { body, content_type });
    }
    Err("Troppi redirect".into())
}

async fn read_limited_body(
    response: reqwest::Response,
    cancel: &CancellationToken,
) -> Result<String, String> {
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = tokio::select! {
        _ = cancel.cancelled() => return Err("Ricerca annullata".into()),
        chunk = stream.next() => chunk,
    } {
        let chunk = chunk.map_err(|e| format!("Lettura risposta fallita: {e}"))?;
        if bytes.len() + chunk.len() > MAX_BODY_BYTES {
            return Err("Risposta troppo grande".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn allowed_content_type(content_type: &str) -> bool {
    [
        "text/html",
        "application/xhtml+xml",
        "text/plain",
        "application/json",
        "application/xml",
        "text/xml",
        "application/rss+xml",
        "application/atom+xml",
    ]
    .iter()
    .any(|allowed| content_type.starts_with(allowed))
}

async fn validate_url(raw: &str) -> Result<ValidatedUrl, String> {
    let url = Url::parse(raw).map_err(|e| format!("URL non valido: {e}"))?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err("Sono ammessi solo URL http/https".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("URL con credenziali non ammesso".into());
    }
    let port = url.port_or_known_default().ok_or("URL senza porta valida")?;
    if port != 80 && port != 443 {
        return Err("Sono ammesse solo le porte 80 e 443".into());
    }
    let host = url.host_str().ok_or("URL senza host")?.to_string();
    if let Ok(ip) = host.parse::<IpAddr>() {
        if !is_public_ip(ip) {
            return Err("Host privato o non pubblico".into());
        }
        return Ok(ValidatedUrl {
            url,
            host: None,
            ip,
            port,
        });
    }
    let addresses: Vec<_> = tokio::net::lookup_host((host.as_str(), port))
        .await
        .map_err(|e| format!("DNS fallito: {e}"))?
        .collect();
    if addresses.is_empty() {
        return Err("DNS senza indirizzi".into());
    }
    if addresses.iter().any(|addr| !is_public_ip(addr.ip())) {
        return Err("Il dominio risolve verso un indirizzo privato".into());
    }
    Ok(ValidatedUrl {
        url,
        host: Some(host),
        ip: addresses[0].ip(),
        port,
    })
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let octets = ip.octets();
            !ip.is_private()
                && !ip.is_loopback()
                && !ip.is_link_local()
                && !ip.is_broadcast()
                && !ip.is_multicast()
                && !ip.is_unspecified()
                && !(octets[0] == 100 && (64..=127).contains(&octets[1]))
                && !(octets[0] == 192 && octets[1] == 0 && octets[2] <= 2)
                && !(octets[0] == 198 && (octets[1] == 18 || octets[1] == 19))
                && !(octets[0] == 198 && octets[1] == 51 && octets[2] == 100)
                && !(octets[0] == 203 && octets[1] == 0 && octets[2] == 113)
                && octets[0] < 240
        }
        IpAddr::V6(ip) => {
            if let Some(mapped) = ip.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(mapped));
            }
            let segments = ip.segments();
            !ip.is_loopback()
                && !ip.is_unspecified()
                && !ip.is_multicast()
                && (segments[0] & 0xfe00) != 0xfc00
                && (segments[0] & 0xffc0) != 0xfe80
                && !(segments[0] == 0x2001 && segments[1] == 0x0db8)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_private_and_special_ips() {
        for raw in [
            "127.0.0.1",
            "10.0.0.1",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "192.0.2.1",
            "198.18.0.1",
            "203.0.113.1",
            "0.0.0.0",
            "224.0.0.1",
            "::1",
            "fc00::1",
            "fe80::1",
            "2001:db8::1",
            "::ffff:127.0.0.1",
        ] {
            let ip: IpAddr = raw.parse().unwrap();
            assert!(!is_public_ip(ip), "{raw} avrebbe dovuto essere bloccato");
        }
        for raw in ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"] {
            let ip: IpAddr = raw.parse().unwrap();
            assert!(is_public_ip(ip), "{raw} avrebbe dovuto essere pubblico");
        }
    }

    #[tokio::test]
    async fn rejects_dangerous_url_shapes() {
        for raw in [
            "file:///etc/passwd",
            "http://localhost/",
            "http://127.0.0.1/",
            "http://[::1]/",
            "http://example.com:8080/",
            "http://user:pass@example.com/",
        ] {
            assert!(validate_url(raw).await.is_err(), "{raw} accettato");
        }
    }

    #[test]
    fn extracts_text_and_title() {
        let (title, text) = extract_html(
            "<html><head><title>Demo</title><style>.x{}</style></head><body><nav>Menu</nav><h1>Benvenuto</h1><p>Testo &amp; altro</p><script>alert(1)</script></body></html>",
        );
        assert_eq!(title, "Demo");
        assert!(text.contains("Benvenuto"));
        assert!(text.contains("Testo & altro"));
        assert!(!text.contains("alert"));
        assert!(!text.contains("Menu"));
    }

    #[test]
    fn parses_bing_rss() {
        let rss = r#"<?xml version="1.0"?><rss><channel><item><title>Uno</title><link>https://example.com/1</link><description>Primo</description><pubDate>oggi</pubDate></item><item><title>Due</title><link>https://example.com/2</link><description>Secondo</description></item></channel></rss>"#;
        let sources = parse_bing_rss(rss);
        assert_eq!(sources.len(), 2);
        assert_eq!(sources[0].title, "Uno");
        assert_eq!(sources[0].url, "https://example.com/1");
        assert_eq!(sources[1].published.as_deref(), None);
    }

    #[test]
    fn reconstructs_openalex_abstract() {
        let value = serde_json::json!({
            "testo": [0, 2],
            "un": [1],
            "esempio": [3]
        });
        assert_eq!(reconstruct_abstract(&value), "testo un testo esempio");
    }

    #[test]
    fn ranks_and_deduplicates() {
        let sources = vec![
            ResearchSource {
                id: String::new(),
                provider: "Bing".into(),
                title: "B".into(),
                url: "https://example.com/a".into(),
                text: "breve".into(),
                published: None,
                retrieved_at: String::new(),
            },
            ResearchSource {
                id: String::new(),
                provider: "Wikipedia".into(),
                title: "W".into(),
                url: "https://example.com/a".into(),
                text: "testo più lungo".into(),
                published: None,
                retrieved_at: String::new(),
            },
        ];
        let ranked = rank_and_limit(sources, "2026-10-26");
        assert_eq!(ranked.len(), 1);
        assert_eq!(ranked[0].provider, "Wikipedia");
        assert_eq!(ranked[0].id, "S1");
        assert_eq!(ranked[0].retrieved_at, "2026-10-26");
    }
}

#[cfg(test)]
mod network_smoke {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn smoke_providers() {
        let client = build_client();
        let plan = ResearchPlan {
            research: true,
            reason: "smoke".into(),
            queries: vec!["Mermaid diagram".into()],
            urls: vec!["https://mermaid.js.org/".into()],
        };
        let outcome = collect(&client, &plan, &CancellationToken::new(), "2026-10-26").await;
        for source in &outcome.sources {
            eprintln!("{} | {} | {}", source.id, source.provider, source.title);
        }
        assert!(!outcome.sources.is_empty(), "nessuna fonte dal smoke");
    }
}
