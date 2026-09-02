use crate::{ManagedStartup, StartupBlock};

/// Return the startup block state (None = app opened normally).
#[tauri::command]
pub fn get_startup_block(state: tauri::State<'_, ManagedStartup>) -> Option<StartupBlock> {
    state.block.clone()
}
