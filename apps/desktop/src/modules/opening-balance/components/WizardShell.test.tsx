import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardShell, type WizardStepDef } from "@modules/opening-balance/components/WizardShell";

const STEPS: WizardStepDef[] = [
  { id: "a", label: "الأصول" },
  { id: "b", label: "الخصوم" },
  { id: "c", label: "حقوق الملكية" },
];

function renderShell(props: Partial<Parameters<typeof WizardShell>[0]> = {}) {
  const onNext = vi.fn();
  const onPrev = vi.fn();
  render(
    <WizardShell
      title="رصيد افتتاح شركة قائمة"
      steps={STEPS}
      stepIndex={0}
      onNext={onNext}
      onPrev={onPrev}
      {...props}
    >
      <div>محتوى الخطوة</div>
    </WizardShell>,
  );
  return { onNext, onPrev };
}

describe("WizardShell", () => {
  it("renders all step labels", () => {
    renderShell();
    expect(screen.getByText("الأصول")).toBeInTheDocument();
    expect(screen.getByText("الخصوم")).toBeInTheDocument();
    expect(screen.getByText("حقوق الملكية")).toBeInTheDocument();
  });

  it("renders the active step's content", () => {
    renderShell();
    expect(screen.getByText("محتوى الخطوة")).toBeInTheDocument();
  });

  it("disables prev on the first step", () => {
    renderShell({ stepIndex: 0 });
    const prev = screen.getByRole("button", { name: /السابق/ });
    expect(prev).toBeDisabled();
  });

  it("enables prev on later steps", () => {
    renderShell({ stepIndex: 1 });
    expect(screen.getByRole("button", { name: /السابق/ })).toBeEnabled();
  });

  it("disables next when canNext is false", () => {
    renderShell({ canNext: false });
    expect(screen.getByRole("button", { name: /التالي|إنهاء/ })).toBeDisabled();
  });

  it("fires onNext when the next button is clicked", async () => {
    const user = userEvent.setup();
    const { onNext } = renderShell({ canNext: true });
    await user.click(screen.getByRole("button", { name: /التالي/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("shows the final label on the last step", () => {
    renderShell({ stepIndex: STEPS.length - 1, isFinal: true });
    expect(screen.getByRole("button", { name: "إنهاء" })).toBeEnabled();
  });

  it("marks passed steps with a check and the active step with its number", () => {
    renderShell({ stepIndex: 1, completedSteps: new Set([0]) });
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});