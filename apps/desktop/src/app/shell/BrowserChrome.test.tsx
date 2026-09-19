import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserChrome } from "./BrowserChrome";

let currentTabStyle: "default" | "browser" | "vscode" = "default";

vi.mock("@shared/hooks/useAppearance", () => ({
  useAppearance: () => ({
    settings: {
      tabStyle: currentTabStyle,
      show: {
        tabs: true,
        search: true,
        notifications: true,
      },
    },
    activeLayout: {
      showTabs: true,
    },
  }),
}));

vi.mock("@app/providers/CurrencyContext", () => ({
  useCurrencyContext: () => ({
    hasMultipleCurrencies: false,
  }),
}));

vi.mock("@app/providers/useGlobalSearch", () => ({
  useGlobalSearch: () => ({
    openSearch: vi.fn(),
    recent: [],
    activateResult: vi.fn(),
  }),
}));

vi.mock("@app/providers/LocalizationProvider", () => ({
  useLocalization: () => ({
    language: "ar",
    direction: "rtl",
    setLanguage: vi.fn(),
    t: (key: string) => key,
  }),
}));

vi.mock("@app/providers/TabContext", () => ({
  useTabs: () => ({
    tabs: [
      { id: "dashboard", title: "Dashboard", path: "/dashboard", active: false, closable: false, pinned: true },
      { id: "journal", title: "Journal", path: "/journal", active: true, closable: true, dirty: true },
    ],
    openTab: vi.fn(),
  }),
}));

vi.mock("@app/providers/VoiceProvider", () => ({
  useVoice: () => ({
    open: vi.fn(),
  }),
}));

vi.mock("@app/providers/useCommands", () => ({
  useCommands: () => ({
    executeCommand: vi.fn(),
  }),
}));

vi.mock("@modules/core/api/settingsService", () => ({
  settingsService: {
    getSettings: () => Promise.resolve({ company_name: "Acme" }),
  },
}));

vi.mock("./NotificationsPanel", () => ({
  NotificationsPanel: () => null,
}));

vi.mock("./TabBar", () => ({
  TabBar: () => <div data-testid="shared-tabbar">tabs</div>,
}));

vi.mock("./WindowControls", () => ({
  WindowControls: ({ variant }: { variant: "default" | "browser" }) => (
    <div data-testid={`window-controls-${variant}`} />
  ),
}));

vi.mock("./useDesktopWindowState", () => ({
  useDesktopWindowState: () => ({
    isTauriWindow: true,
    isMaximized: false,
    isFullscreen: false,
    isFocused: true,
    ready: true,
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    setWindowTitle: vi.fn(),
  }),
}));

describe("BrowserChrome", () => {
  beforeEach(() => {
    currentTabStyle = "default";
    window.localStorage.clear();
  });

  it("keeps the detached tab bar only in default mode", async () => {
    await act(async () => {
      render(<BrowserChrome />);
    });

    expect(screen.getByTestId("default-window-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("default-detached-tabbar")).toBeInTheDocument();
    expect(screen.queryByTestId("browser-window-chrome")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("shared-tabbar")).toHaveLength(1);
    expect(screen.getByTestId("window-controls-default")).toBeInTheDocument();
  });

  it("embeds tabs inside the title bar in browser mode without a detached bar", async () => {
    currentTabStyle = "browser";

    await act(async () => {
      render(<BrowserChrome />);
    });

    expect(screen.getByTestId("browser-window-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("browser-titlebar-tabs")).toBeInTheDocument();
    expect(screen.queryByTestId("default-detached-tabbar")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("shared-tabbar")).toHaveLength(1);
    expect(screen.getByTestId("window-controls-browser")).toBeInTheDocument();
  });

  it("switches between default and browser modes without leaving duplicate tab bars", async () => {
    let rerender: ReturnType<typeof render>["rerender"];

    await act(async () => {
      ({ rerender } = render(<BrowserChrome />));
    });

    expect(screen.getAllByTestId("shared-tabbar")).toHaveLength(1);
    expect(screen.getByTestId("default-detached-tabbar")).toBeInTheDocument();

    currentTabStyle = "browser";
    await act(async () => {
      rerender(<BrowserChrome />);
    });

    expect(screen.getAllByTestId("shared-tabbar")).toHaveLength(1);
    expect(screen.getByTestId("browser-titlebar-tabs")).toBeInTheDocument();
    expect(screen.queryByTestId("default-detached-tabbar")).not.toBeInTheDocument();

    currentTabStyle = "default";
    await act(async () => {
      rerender(<BrowserChrome />);
    });

    expect(screen.getAllByTestId("shared-tabbar")).toHaveLength(1);
    expect(screen.getByTestId("default-detached-tabbar")).toBeInTheDocument();
    expect(screen.queryByTestId("browser-titlebar-tabs")).not.toBeInTheDocument();
  });
});
