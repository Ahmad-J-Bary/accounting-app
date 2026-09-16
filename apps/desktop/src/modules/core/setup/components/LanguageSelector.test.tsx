import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageSelector } from "./LanguageSelector";

const LANGUAGE_KEY = "erp_language";

describe("FirstLaunchLanguageGate — LanguageSelector", () => {
  beforeEach(() => {
    localStorage.removeItem(LANGUAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(LANGUAGE_KEY);
  });

  it("renders bilingual title", () => {
    render(<LanguageSelector onComplete={() => {}} />);
    expect(screen.getByText("اختر اللغة")).toBeInTheDocument();
    expect(screen.getByText("Choose Language")).toBeInTheDocument();
  });

  it("renders Arabic, English buttons and Next button", () => {
    render(<LanguageSelector onComplete={() => {}} />);
    expect(screen.getByRole("button", { name: /العربية/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /English/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /التالي|Next/i })).toBeInTheDocument();
  });

  it("calls onComplete with 'ar' when Arabic is selected and Next is clicked", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<LanguageSelector onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: /العربية/i }));
    await user.click(screen.getByRole("button", { name: /التالي|Next/i }));

    expect(onComplete).toHaveBeenCalledWith("ar");
  });

  it("calls onComplete with 'en' when English is selected and Next is clicked", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<LanguageSelector onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: /English/i }));
    await user.click(screen.getByRole("button", { name: /التالي|Next/i }));

    expect(onComplete).toHaveBeenCalledWith("en");
  });

  it("does NOT call onComplete when only a language is clicked (without Next)", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<LanguageSelector onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: /العربية/i }));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("does NOT persist to localStorage directly — parent is responsible", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<LanguageSelector onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: /العربية/i }));
    await user.click(screen.getByRole("button", { name: /التالي|Next/i }));

    // LanguageSelector calls onComplete — the PARENT (App.tsx) persists
    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
    expect(onComplete).toHaveBeenCalled();
  });

  it("disables buttons after Next is clicked (prevents double-click)", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<LanguageSelector onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: /العربية/i }));
    const nextBtn = screen.getByRole("button", { name: /التالي|Next/i });
    await user.click(nextBtn);

    expect(nextBtn).toBeDisabled();
  });

  it("renders without any provider — standalone", () => {
    // LanguageSelector must work without LocalizationProvider, QueryClient, etc.
    const { container } = render(<LanguageSelector onComplete={() => {}} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("shows 'You can change this later in Settings' text", () => {
    render(<LanguageSelector onComplete={() => {}} />);
    expect(screen.getByText("You can change this later in Settings")).toBeInTheDocument();
  });
});
