// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Workaround for Ubuntu 26.04 (and later) gdk-pixbuf glycin sandbox bug:
    // gdk-pixbuf is patched to decode images through glycin-image-rs via bwrap,
    // but the bwrap sandbox lacks D-Bus access, causing a hard GTK abort when
    // any icon is loaded. By setting prgname to "gdk-pixbuf-thumbnailer" we
    // trigger the unsandboxed code path in gdk-pixbuf's io-glycin-utils.c,
    // bypassing the broken bwrap sandbox entirely.
    #[cfg(target_os = "linux")]
    glib::set_prgname(Some("gdk-pixbuf-thumbnailer"));

    tauri_adapter::run()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
