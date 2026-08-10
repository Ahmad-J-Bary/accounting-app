import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@shared/ui/status-badge";

describe("StatusBadge", () => {
  it("renders a known Arabic label from the shared registry", () => {
    render(<StatusBadge status="Posted" />);
    expect(screen.getByText("مرحّل")).toBeInTheDocument();
  });

  it("falls back to the raw status when unknown", () => {
    render(<StatusBadge status="UnknownStatus" />);
    expect(screen.getByText("UnknownStatus")).toBeInTheDocument();
  });

  it("prefers an explicit label prop over the registry", () => {
    render(<StatusBadge status="Posted" label="مُرحّل يدوياً" />);
    expect(screen.getByText("مُرحّل يدوياً")).toBeInTheDocument();
  });

  it("applies the tone class for a known status", () => {
    const { container } = render(<StatusBadge status="Posted" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("bg-green-50");
  });

  it("applies the sm size class by default and md when requested", () => {
    const { container, rerender } = render(<StatusBadge status="Open" />);
    expect(container.querySelector("span")?.className).toContain("text-2xs");
    rerender(<StatusBadge status="Open" size="md" />);
    expect(container.querySelector("span")?.className).toContain("text-xs");
  });
});