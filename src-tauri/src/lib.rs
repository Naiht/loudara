use std::{collections::HashMap, sync::OnceLock, time::Duration};

use serde::Serialize;

#[derive(Serialize)]
struct HttpFetchResponse {
  status: u16,
  headers: HashMap<String, String>,
  body: Vec<u8>,
}

fn http_client() -> Result<&'static reqwest::Client, String> {
  static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
  CLIENT
    .get_or_init(|| {
      reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())
    })
    .as_ref()
    .map_err(Clone::clone)
}

#[tauri::command]
async fn http_fetch(
  url: String,
  method: Option<String>,
  headers: Option<HashMap<String, String>>,
  body: Option<Vec<u8>>,
) -> Result<HttpFetchResponse, String> {
  let url = reqwest::Url::parse(&url).map_err(|error| error.to_string())?;
  if !matches!(url.scheme(), "http" | "https") {
    return Err("Only HTTP and HTTPS URLs are supported".into());
  }

  let method = method.unwrap_or_else(|| "GET".to_string())
    .parse::<reqwest::Method>()
    .map_err(|error| error.to_string())?;
  let mut request = http_client()?.request(method, url);

  for (key, value) in headers.unwrap_or_default() {
    request = request.header(&key, &value);
  }
  if let Some(bytes) = body {
    request = request.body(bytes);
  }

  let response = request.send().await.map_err(|error| error.to_string())?;
  let status = response.status().as_u16();
  let headers = response.headers().iter()
    .filter_map(|(name, value)| value.to_str().ok().map(|value| (name.to_string(), value.to_string())))
    .collect();
  let body = response.bytes().await.map_err(|error| error.to_string())?.to_vec();

  Ok(HttpFetchResponse { status, headers, body })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![http_fetch])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
