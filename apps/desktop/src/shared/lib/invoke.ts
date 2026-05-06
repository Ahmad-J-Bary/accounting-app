// Desktop-only IPC adapter — routes all calls directly to the Tauri Rust backend.
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (e) {
    console.error(`[IPC] Command "${cmd}" failed:`, e);
    throw e;
  }
}
