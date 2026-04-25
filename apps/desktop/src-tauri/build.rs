use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=WebView2Loader.dll");

    let manifest_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is not set by Cargo"),
    );
    let source_dll = manifest_dir.join("WebView2Loader.dll");

    if source_dll.exists() {
        let out_dir =
            PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR is not set by Cargo for build script"));
        let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());

        let target_profile_dir = out_dir
            .ancestors()
            .find(|candidate| candidate.file_name() == Some(std::ffi::OsStr::new(&profile)))
            .map(Path::to_path_buf)
            .expect("Failed to resolve Cargo target profile directory from OUT_DIR");

        let dest_dll = target_profile_dir.join("WebView2Loader.dll");

        if let Err(err) = fs::copy(&source_dll, &dest_dll) {
            // If the file is locked but exists, it's likely already the correct version
            let is_locked = err.kind() == std::io::ErrorKind::PermissionDenied || err.raw_os_error() == Some(32);
            if dest_dll.exists() && is_locked {
                println!("cargo:warning=Could not update WebView2Loader.dll (file locked), but it already exists. Continuing build.");
            } else {
                panic!("Failed to copy WebView2Loader.dll to '{}': {err}", dest_dll.display());
            }
        }
    } else {
        println!(
            "cargo:warning=WebView2Loader.dll was not found at '{}'",
            source_dll.display()
        );
    }

    tauri_build::build()
}
