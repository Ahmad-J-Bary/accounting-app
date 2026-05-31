use tauri::{AppHandle, Emitter};
use std::fs::File;
use std::io::Write;
use futures_util::StreamExt;

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    downloaded: u64,
    total: Option<u64>,
}

#[tauri::command]
pub async fn download_and_install_update(
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
        return Err(format!("Server returned error status: {}", response.status()));
    }

    let total_size = response.content_length();
    
    // 3. Determine file name and temp path
    let filename = if url.ends_with(".msi") {
        "almowakeb_update.msi"
    } else if url.ends_with(".exe") {
        "almowakeb_update.exe"
    } else if url.contains(".msi") {
        "almowakeb_update.msi"
    } else {
        "almowakeb_update.exe"
    };
    
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(filename);
    
    // 4. Download file with progress reporting
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
        
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    
    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Error while downloading: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write to file: {}", e))?;
        downloaded += chunk.len() as u64;
        
        // Emit progress event to frontend
        let _ = app.emit("update-progress", DownloadProgress {
            downloaded,
            total: total_size,
        });
    }
    
    // Explicitly flush and drop file to release lock
    file.flush().map_err(|e| format!("Failed to flush file: {}", e))?;
    drop(file);
    
    // 5. Execute the installer
    #[cfg(target_os = "windows")]
    {
        if filename.ends_with(".msi") {
            std::process::Command::new("msiexec")
                .arg("/i")
                .arg(&file_path)
                .arg("/passive") // Runs with simple progress bar, no user interaction
                .spawn()
                .map_err(|e| format!("Failed to run MSI installer: {}", e))?;
        } else {
            std::process::Command::new(&file_path)
                .spawn()
                .map_err(|e| format!("Failed to run EXE installer: {}", e))?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open DMG: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open package: {}", e))?;
    }

    // 6. Exit the application to release process lock on files and allow installer to proceed
    std::process::exit(0);
}
