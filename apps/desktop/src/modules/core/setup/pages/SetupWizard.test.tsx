import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SetupWizard from "@modules/core/setup/pages/SetupWizard";
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
      screen.getByText("شركة موجودة مسبقًا وسيتم إدخال وضعها المالي عند بدء استخدام النظام."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("شركة جديدة وسيبدأ تسجيل العمليات المحاسبية من بداية استخدام النظام."),
    ).toBeInTheDocument();
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