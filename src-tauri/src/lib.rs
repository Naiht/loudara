use std::{
  collections::HashMap,
  fs,
  path::PathBuf,
  process::Command,
  time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;

#[derive(Serialize)]
struct HttpFetchResponse {
  status: u16,
  headers: HashMap<String, String>,
  body: Vec<u8>,
}

fn temp_file_path(prefix: &str, suffix: &str) -> PathBuf {
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_nanos())
    .unwrap_or_default();

  std::env::temp_dir().join(format!(
    "loudara_{}_{}_{}{}",
    prefix,
    std::process::id(),
    nanos,
    suffix
  ))
}

#[tauri::command]
async fn http_fetch(
  url: String,
  method: Option<String>,
  headers: Option<HashMap<String, String>>,
  body: Option<Vec<u8>>,
) -> Result<HttpFetchResponse, String> {
  let header_path = temp_file_path("headers", ".txt");
  let body_path = temp_file_path("body", ".bin");
  let body_input_path = temp_file_path("request", ".bin");

  let request_method = method.unwrap_or_else(|| "GET".to_string());

  let mut command = Command::new("curl.exe");
  command
    .arg("--silent")
    .arg("--show-error")
    .arg("--location")
    .arg("--request")
    .arg(&request_method)
    .arg("--dump-header")
    .arg(&header_path)
    .arg("--output")
    .arg(&body_path)
    .arg("--write-out")
    .arg("%{http_code}");

  if let Some(header_values) = headers {
    for (key, value) in header_values {
      command.arg("--header").arg(format!("{}: {}", key, value));
    }
  }

  if let Some(bytes) = body {
    if !bytes.is_empty() {
      fs::write(&body_input_path, bytes).map_err(|error| error.to_string())?;
      command.arg("--data-binary").arg(format!("@{}", body_input_path.display()));
    }
  }

  command.arg(&url);

  let output = command.output().map_err(|error| error.to_string())?;

  let cleanup = || {
    let _ = fs::remove_file(&header_path);
    let _ = fs::remove_file(&body_path);
    let _ = fs::remove_file(&body_input_path);
  };

  if !output.status.success() {
    cleanup();
    return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
  }

  let status = String::from_utf8_lossy(&output.stdout)
    .trim()
    .parse::<u16>()
    .map_err(|error| error.to_string())?;

  let header_text = fs::read_to_string(&header_path).unwrap_or_default();
  let body = fs::read(&body_path).unwrap_or_default();

  let mut response_headers = HashMap::new();
  for line in header_text.lines() {
    if let Some((key, value)) = line.split_once(':') {
      response_headers.insert(key.trim().to_string(), value.trim().to_string());
    }
  }

  cleanup();

  Ok(HttpFetchResponse {
    status,
    headers: response_headers,
    body,
  })
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
