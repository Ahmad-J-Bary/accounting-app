import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const LANGUAGE_KEY = "erp_language";

const mockIsSetupComplete = vi.hoisted(() =>
  vi.fn().mockResolvedValue(true)
);

vi.mock("@modules/core/api/currencyService", () => ({
  currencyService: {
    isSetupComplete: (...args: unknown[]) => mockIsSetupComplete(...args),
  },
}));

vi.mock("@modules/core/api/backupService", () => ({
  backupService: {
    getStartupBlock: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    listen: vi.fn().mockResolvedValue(() => {}),
  }),
}));

import App from "./App";

describe("App — Language Gate (7 cases)", () => {
  beforeEach(() => {
    localStorage.removeItem(LANGUAGE_KEY);
    mockIsSetupComplete.mockReset();
    mockIsSetupComplete.mockResolvedValue(true);
  });

  it("case 1: fresh install (no erp_language) — selector renders, zero IPC", async () => {
    mockIsSetupComplete.mockResolvedValue(true);
    render(<App />);

    expect(screen.getByText("اختر اللغة")).toBeInTheDocument();
    expect(screen.getByText("Choose Language")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /العربية/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /English/i })).toBeInTheDocument();
    expect(mockIsSetupComplete).not.toHaveBeenCalled();
  });

  it("case 1b: fresh install — no provider spinner", () => {
    const { container } = render(<App />);
    expect(screen.getByText("اختر اللغة")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("case 2: reset with ar — selector with initialLanguage ar (visual default)", async () => {
    localStorage.setItem(LANGUAGE_KEY, "ar");
    mockIsSetupComplete.mockResolvedValue(false);
    render(<App />);

    await waitFor(() => {
      expect(mockIsSetupComplete).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("اختر اللغة")).toBeInTheDocument();
  });

  it("case 3: reset with en — selector with initialLanguage en (visual default)", async () => {
    localStorage.setItem(LANGUAGE_KEY, "en");
    mockIsSetupComplete.mockResolvedValue(false);
    render(<App />);

    await waitFor(() => {
      expect(mockIsSetupComplete).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("اختر اللغة")).toBeInTheDocument();
  });

  it("case 4: configured ar (erp_language=ar + setup complete) — skips selector", async () => {
    localStorage.setItem(LANGUAGE_KEY, "ar");
    mockIsSetupComplete.mockResolvedValue(true);
    render(<App />);

    await waitFor(() => {
      expect(mockIsSetupComplete).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("اختر اللغة")).not.toBeInTheDocument();
  });

  it("case 5: configured en (erp_language=en + setup complete) — skips selector", async () => {
    localStorage.setItem(LANGUAGE_KEY, "en");
    mockIsSetupComplete.mockResolvedValue(true);
    render(<App />);

    await waitFor(() => {
      expect(mockIsSetupComplete).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("اختر اللغة")).not.toBeInTheDocument();
  });

  it("case 6: full reset (no erp_language) — selector renders", () => {
    localStorage.removeItem(LANGUAGE_KEY);
    mockIsSetupComplete.mockResolvedValue(true);
    render(<App />);

    expect(screen.getByText("اختر اللغة")).toBeInTheDocument();
    expect(mockIsSetupComplete).not.toHaveBeenCalled();
  });

  it("case 7: invalid stored value — selector renders (treated as fresh)", () => {
    localStorage.setItem(LANGUAGE_KEY, "xyz");
    mockIsSetupComplete.mockResolvedValue(true);
    render(<App />);

    expect(screen.getByText("اختر اللغة")).toBeInTheDocument();
    expect(mockIsSetupComplete).not.toHaveBeenCalled();
  });

  it("persists erp_language to localStorage after user selects a language and clicks Next", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /العربية/i }));
    await user.click(screen.getByRole("button", { name: /التالي|Next/i }));

    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("ar");
  });

  it("switches to NormalStartup after language selection and Next click (no infinite loop)", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("اختر اللغة")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /العربية/i }));
    await user.click(screen.getByRole("button", { name: /التالي|Next/i }));

    expect(screen.queryByText("اختر اللغة")).not.toBeInTheDocument();
  });
});
