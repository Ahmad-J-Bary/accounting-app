use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
#[cfg_attr(not(target_os = "windows"), allow(unused_imports))]
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    downloaded: u64,
    total: Option<u64>,
}

static UPDATE_FILE_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);
static EXPECTED_SHA256: Mutex<Option<String>> = Mutex::new(None);

fn compute_sha256(file_path: &PathBuf) -> Result<String, String> {
    let mut file =
        File::open(file_path).map_err(|e| format!("Failed to open file for SHA256: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192];

    loop {
        let bytes_read = std::io::Read::read(&mut file, &mut buffer)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

#[tauri::command]
pub async fn download_and_prepare_update(
    app: AppHandle,
    url: String,
    expected_sha256: Option<String>,
) -> Result<(), String> {
    *EXPECTED_SHA256.lock().unwrap() = expected_sha256.clone();

    let client = reqwest::Client::builder()
        .user_agent("Almowakeb-ERP-Updater")
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        let err = format!("Server returned error status: {}", response.status());
        let _ = app.emit("update-failed", err.clone());
        return Err(err);
    }

    let total_size = response.content_length();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let is_msi = url.ends_with(".msi") || url.contains(".msi");
    let filename = if is_msi {
        format!("almowakeb_update_{}.msi", timestamp)
    } else {
        format!("almowakeb_update_{}.exe", timestamp)
    };

    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&filename);

    let mut file =
        File::create(&file_path).map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();
    let mut stream = response.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Error while downloading: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write to file: {}", e))?;
        downloaded += chunk.len() as u64;

        let total = total_size.unwrap_or(0);
        if last_emit.elapsed().as_millis() >= 50 || downloaded == total {
            let _ = app.emit(
                "update-progress",
                DownloadProgress {
                    downloaded,
                    total: total_size,
                },
            );
            last_emit = std::time::Instant::now();
        }
    }

    file.sync_all()
        .map_err(|e| format!("Failed to sync file to disk: {}", e))?;
    drop(file);

    *UPDATE_FILE_PATH.lock().unwrap() = Some(file_path.clone());

    let _ = app.emit("update-verifying", ());

    if let Some(expected_hash) = expected_sha256 {
        let actual_hash = compute_sha256(&file_path)?;
        if actual_hash.to_lowercase() != expected_hash.to_lowercase() {
            let err = "Downloaded file SHA256 does not match expected value".to_string();
            let _ = app.emit("update-failed", err.clone());
            return Err(err);
        }
    }

    let _ = app.emit("update-preparing", ());
    tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;

    let _ = app.emit("update-ready", ());
    Ok(())
}

#[tauri::command]
pub async fn apply_update_and_restart(app: AppHandle) -> Result<(), String> {
    let file_path_opt = UPDATE_FILE_PATH.lock().unwrap().clone();
    let file_path = file_path_opt.ok_or_else(|| "No update file found".to_string())?;

    #[cfg(target_os = "windows")]
    {
        let _ = &app;
        let current_exe = std::env::current_exe()
            .map_err(|e| format!("Failed to get current exe path: {}", e))?;
        let install_dir = current_exe
            .parent()
            .ok_or_else(|| "Failed to get install directory".to_string())?;

        let temp_dir = std::env::temp_dir();
        let batch_path = temp_dir.join("almowakeb_update.bat");

        let is_msi = file_path
            .file_name()
            .and_then(|f| f.to_str())
            .map(|f| f.ends_with(".msi"))
            .unwrap_or(false);

        let mut batch = std::fs::File::create(&batch_path)
            .map_err(|e| format!("Failed to create update script: {}", e))?;

        if is_msi {
            write!(batch,
                "@echo off\r\nstart /wait msiexec /i \"{}\" /quiet /norestart\r\nstart \"\" /d \"{}\" \"{}\"\r\ndel \"%~f0\"\r\n",
                file_path.display(),
                install_dir.display(),
                current_exe.display()
            ).map_err(|e| format!("Failed to write update script: {}", e))?;
        } else {
            write!(batch,
                "@echo off\r\nstart /wait \"\" \"{}\" /S\r\nstart \"\" /d \"{}\" \"{}\"\r\ndel \"%~f0\"\r\n",
                file_path.display(),
                install_dir.display(),
                current_exe.display()
            ).map_err(|e| format!("Failed to write update script: {}", e))?;
        }

        drop(batch);

        std::process::Command::new("cmd")
            .args([
                "/c",
                "start",
                "/b",
                "",
                batch_path.to_string_lossy().as_ref(),
            ])
            .spawn()
            .map_err(|e| format!("Failed to launch update script: {}", e))?;

        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, &file_path);
        Err("Auto-update is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle, url: String) -> Result<(), String> {
    download_and_prepare_update(app.clone(), url, None).await?;
    apply_update_and_restart(app).await
}

#[tauri::command]
pub fn compute_sha256_command(file_path: String) -> Result<String, String> {
    compute_sha256(&PathBuf::from(file_path))
}

#[tauri::command]
pub fn get_file_size(file_path: String) -> Result<u64, String> {
    let metadata =
        std::fs::metadata(file_path).map_err(|e| format!("Failed to get file metadata: {}", e))?;
    Ok(metadata.len())
}
