import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TauriWindow = {
  isMaximized: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  isFocused: () => Promise<boolean>;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  setTitle: (title: string) => Promise<void>;
  onResized: (handler: () => void) => Promise<() => void>;
  onFocusChanged: (handler: (event: { payload: boolean }) => void) => Promise<() => void>;
};

interface DesktopWindowState {
  isTauriWindow: boolean;
  isMaximized: boolean;
  isFullscreen: boolean;
  isFocused: boolean;
  ready: boolean;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  setWindowTitle: (title: string) => Promise<void>;
}

function canUseTauriWindow() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useDesktopWindowState(): DesktopWindowState {
  const isTauriWindow = useMemo(canUseTauriWindow, []);
  const windowRef = useRef<TauriWindow | null>(null);
  const [ready, setReady] = useState(!isTauriWindow);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    if (!isTauriWindow) return;

    let mounted = true;
    let cleanup: Array<() => void> = [];

    const initializeWindow = async () => {
      const module = await import("@tauri-apps/api/window");
      const currentWindow = module.getCurrentWindow();
      windowRef.current = currentWindow;

      const syncState = async () => {
        const [maximized, fullscreen, focused] = await Promise.all([
          currentWindow.isMaximized(),
          currentWindow.isFullscreen(),
          currentWindow.isFocused(),
        ]);

        if (!mounted) return;
        setIsMaximized(maximized);
        setIsFullscreen(fullscreen);
        setIsFocused(focused);
        setReady(true);
      };

      await syncState();

      cleanup = await Promise.all([
        currentWindow.onResized(() => {
          void syncState();
        }),
        currentWindow.onFocusChanged(({ payload }) => {
          if (!mounted) return;
          setIsFocused(Boolean(payload));
        }),
      ]);
    };

    void initializeWindow().catch(() => {
      if (mounted) {
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      cleanup.forEach((unlisten) => unlisten());
    };
  }, [isTauriWindow]);

  const invokeWindow = useCallback(async (action: (currentWindow: TauriWindow) => Promise<void>) => {
    const currentWindow = windowRef.current;
    if (!currentWindow) return;
    await action(currentWindow);
  }, []);

  const setWindowTitle = useCallback(
    async (title: string) => {
      await invokeWindow((currentWindow) => currentWindow.setTitle(title));
    },
    [invokeWindow],
  );

  return {
    isTauriWindow,
    isMaximized,
    isFullscreen,
    isFocused,
    ready,
    minimize: useCallback(() => invokeWindow((currentWindow) => currentWindow.minimize()), [invokeWindow]),
    toggleMaximize: useCallback(() => invokeWindow((currentWindow) => currentWindow.toggleMaximize()), [invokeWindow]),
    close: useCallback(() => invokeWindow((currentWindow) => currentWindow.close()), [invokeWindow]),
    setWindowTitle,
  };
}
