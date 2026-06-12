use tauri::{AppHandle, Emitter, Manager};
use std::fs::File;
use std::io::Write;
use std::sync::Mutex;
use futures_util::StreamExt;

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    downloaded: u64,
    total: Option<u64>,
}

// Store the path to the downloaded update file so we can use it later
static UPDATE_FILE_PATH: Mutex<Option<std::path::PathBuf>> = Mutex::new(None);

#[tauri::command]
pub async fn download_and_prepare_update(
    app: AppHandle,
    url: String,
) -> Result<(), String> {
    // 1. Create a client with a custom User-Agent to satisfy GitHub's requirements
    let client = reqwest::Client::builder()
        .user_agent("Almowakeb-ERP-Updater")
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))?;
    
    // 2. Fetch the URL
    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        let err = format!("Server returned error status: {}", response.status());
        let _ = app.emit("update-failed", err.clone());
        return Err(err);
    }

    let total_size = response.content_length();
    
    // 3. Determine file name and temp path
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
    
    // 4. Download file with progress reporting
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
        
    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();
    let mut stream = response.bytes_stream();
    
    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Error while downloading: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write to file: {}", e))?;
        downloaded += chunk.len() as u64;
        
        // Emit progress event to frontend, throttled to prevent UI freeze
        let total = total_size.unwrap_or(0);
        if last_emit.elapsed().as_millis() >= 50 || downloaded == total {
            let _ = app.emit("update-progress", DownloadProgress {
                downloaded,
                total: total_size,
            });
            last_emit = std::time::Instant::now();
        }
    }
    
    // Explicitly flush to disk and drop file to release lock
    file.sync_all().map_err(|e| format!("Failed to sync file to disk: {}", e))?;
    drop(file);

    // Store the file path for later use
    *UPDATE_FILE_PATH.lock().unwrap() = Some(file_path.clone());

    // Notify frontend that the update is ready to be applied
    let _ = app.emit("update-ready", ());
    Ok(())
}

#[tauri::command]
pub async fn apply_update_and_restart(
    app: AppHandle,
) -> Result<(), String> {
    let file_path_opt = UPDATE_FILE_PATH.lock().unwrap().clone();
    let file_path = file_path_opt.ok_or_else(|| "No update file found".to_string())?;

    let filename = file_path.file_name().and_then(|f| f.to_str()).unwrap_or("");

    // 5. Execute the installer silently
    #[cfg(target_os = "windows")]
    {
        if filename.ends_with(".msi") {
            // /quiet: No user interaction
            // /norestart: Don't restart automatically (we'll handle that)
            let status = std::process::Command::new("msiexec")
                .arg("/i")
                .arg(&file_path)
                .arg("/quiet")
                .arg("/norestart")
                .status()
                .map_err(|e| format!("Failed to run MSI installer: {}", e))?;

            if !status.success() {
                let err = format!("MSI installer returned non-zero exit code: {}", status);
                let _ = app.emit("update-failed", err.clone());
                return Err(err);
            }
        } else {
            // For EXE installers, try to find silent options.
            // Common options: /S, /silent, /quiet, --silent
            // Let's try /S first (common for NSIS installers)
            let mut cmd = std::process::Command::new(&file_path);
            cmd.arg("/S");
            
            let status = cmd.status().map_err(|e| format!("Failed to run EXE installer: {}", e))?;

            if !status.success() {
                // If /S failed, try /silent
                let mut cmd2 = std::process::Command::new(&file_path);
                cmd2.arg("/silent");
                let status2 = cmd2.status();
                
                if let Err(e) = status2 {
                    let err = format!("Failed to run EXE installer (both /S and /silent failed): {}", e);
                    let _ = app.emit("update-failed", err.clone());
                    return Err(err);
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // For DMG: mount it, copy app to Applications, then restart
        unimplemented!("macOS updates not fully implemented yet");
    }

    #[cfg(target_os = "linux")]
    {
        unimplemented!("Linux updates not fully implemented yet");
    }

    // Restart the app
    tauri::process::restart(&app.env());
    Ok(())
}

// Keep the old command for backwards compatibility
#[tauri::command]
pub async fn download_and_install_update(
    app: AppHandle,
    url: String,
) -> Result<(), String> {
    download_and_prepare_update(app.clone(), url).await?;
    apply_update_and_restart(app).await
}
