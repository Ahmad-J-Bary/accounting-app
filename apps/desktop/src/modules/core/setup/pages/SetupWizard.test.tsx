import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SetupWizard from "@modules/core/setup/pages/setupWizard";
import { currencyService } from "@modules/core/api/currencyService";
import { settingsService } from "@modules/core/api/settingsService";
import { COMPANY_TYPE_EXISTING, COMPANY_TYPE_NEW } from "@modules/opening-balance/lib/wizard-types";

vi.mock("@modules/core/api/currencyService", () => ({
  currencyService: {
    isSetupComplete: vi.fn(),
    getWorldCurrencies: vi.fn().mockResolvedValue([]),
    setupCurrencies: vi.fn(),
  },
}));

vi.mock("@modules/core/api/settingsService", () => ({
  settingsService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn().mockResolvedValue({}),
  },
}));

function renderSetup() {
  return render(
    <MemoryRouter initialEntries={["/setup"]}>
      <SetupWizard />
    </MemoryRouter>,
  );
}

describe("SetupWizard company type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to شركة قائمة (EXISTING) and shows both descriptions", async () => {
    vi.mocked(currencyService.isSetupComplete).mockResolvedValue(true);
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      company_name: "شركتي",
      currency: "SAR",
    } as never);

    renderSetup();

    await screen.findByText("نوع الشركة");
    const existing = screen.getByLabelText("شركة قائمة");
    const fresh = screen.getByLabelText("شركة جديدة");
    expect(existing).toHaveAttribute("data-state", "checked");
    expect(fresh).toHaveAttribute("data-state", "unchecked");

    expect(
      screen.getByText("لديك بيانات مالية سابقة وتريد نقل الوضع الحالي للشركة إلى التطبيق."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ستبدأ المحاسبة من بداية نشاط الشركة داخل التطبيق."),
    ).toBeInTheDocument();
  });

  it("shows a clear selected state on the EXISTING card by default", async () => {
    vi.mocked(currencyService.isSetupComplete).mockResolvedValue(true);
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      company_name: "شركتي",
      currency: "SAR",
    } as never);

    renderSetup();

    await screen.findByText("نوع الشركة");
    const existingCard = screen.getByLabelText("شركة قائمة").closest("label");
    const newCard = screen.getByLabelText("شركة جديدة").closest("label");
    expect(existingCard?.className).toContain("ring-emerald-200");
    expect(newCard?.className).not.toContain("ring-emerald-200");
  });

  it("moves the clear selected state when شركة جديدة is picked", async () => {
    const user = userEvent.setup();
    vi.mocked(currencyService.isSetupComplete).mockResolvedValue(true);
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      company_name: "شركتي",
      currency: "SAR",
    } as never);

    renderSetup();
    await screen.findByText("نوع الشركة");
    await user.click(screen.getByLabelText("شركة جديدة"));

    const existingCard = screen.getByLabelText("شركة قائمة").closest("label");
    const newCard = screen.getByLabelText("شركة جديدة").closest("label");
    expect(existingCard?.className).not.toContain("ring-emerald-200");
    expect(newCard?.className).toContain("ring-emerald-200");
  });

  it("persists the chosen company type in the update settings payload", async () => {
    const user = userEvent.setup();
    vi.mocked(currencyService.isSetupComplete).mockResolvedValue(true);
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      company_name: "شركتي",
      currency: "SAR",
    } as never);

    renderSetup();
    await screen.findByText("نوع الشركة");
    await user.type(screen.getByPlaceholderText("أدخل اسم المنشأة"), "شركة الاختبار");
    await user.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => {
      expect(settingsService.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ accounting_start_mode: COMPANY_TYPE_EXISTING }),
      );
    });
  });

  it("sends NEW when شركة جديدة is selected", async () => {
    const user = userEvent.setup();
    vi.mocked(currencyService.isSetupComplete).mockResolvedValue(true);
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      company_name: "شركتي",
      currency: "SAR",
    } as never);

    renderSetup();
    await screen.findByText("نوع الشركة");
    await user.click(screen.getByLabelText("شركة جديدة"));
    await user.type(screen.getByPlaceholderText("أدخل اسم المنشأة"), "شركة جديدة الاختبار");
    await user.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => {
      expect(settingsService.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ accounting_start_mode: COMPANY_TYPE_NEW }),
      );
    });
  });
});