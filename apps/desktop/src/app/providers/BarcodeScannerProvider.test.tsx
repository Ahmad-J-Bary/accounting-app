import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BarcodeScannerProvider, useBarcodeScanner } from "./BarcodeScannerProvider";

function Probe() {
  const { activeSession, beginScan, submitScan } = useBarcodeScanner();
  return (
    <div>
      <span data-testid="session">{activeSession?.targetId || "none"}</span>
      <button
        onClick={() =>
          beginScan({
            targetId: "material-barcode",
            label: "الباركود العام",
            source: "manual",
            onDetected: () => undefined,
          })
        }
      >
        open
      </button>
      <button onClick={() => submitScan("123456")}>submit</button>
    </div>
  );
}

describe("BarcodeScannerProvider", () => {
  it("opens and closes a scan session", () => {
    render(
      <BarcodeScannerProvider>
        <Probe />
      </BarcodeScannerProvider>,
    );

    expect(screen.getByTestId("session").textContent).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByTestId("session").textContent).toBe("material-barcode");
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(screen.getByTestId("session").textContent).toBe("none");
  });
});
