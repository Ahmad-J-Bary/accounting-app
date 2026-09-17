import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableToolbar } from "./TableToolbar";
import { TableSettingsProvider } from "@app/providers/TableSettingsProvider";
import React from "react";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <TableSettingsProvider>
      {ui}
    </TableSettingsProvider>
  );
}

describe("TableToolbar", () => {
  it("renders Export Excel in inline-end when onExportExcel is provided", () => {
    const onExport = vi.fn();
    renderWithProviders(
      <TableToolbar
        columns={[]}
        onExportExcel={onExport}
        showViewOptions={false}
      />
    );

    const exportBtn = screen.getByText(/exportExcel|تصدير إكسل/i);
    expect(exportBtn).toBeInTheDocument();
    fireEvent.click(exportBtn);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("renders View, Columns, and Export together in inline-end", () => {
    const onToggle = vi.fn();
    const onExport = vi.fn();
    renderWithProviders(
      <TableToolbar
        columns={[
          { id: "col1", label: "Column 1", visible: true },
          { id: "col2", label: "Column 2", visible: false },
        ]}
        onColumnToggle={onToggle}
        onExportExcel={onExport}
        showViewOptions={true}
      />
    );

    expect(screen.getByText(/labels\.view|العرض/i)).toBeInTheDocument();
    expect(screen.getByText(/labels\.columns|الأعمدة/i)).toBeInTheDocument();
    expect(screen.getByText(/labels\.exportExcel|تصدير إكسل/i)).toBeInTheDocument();
  });

  it("renders Columns only when view options are customized", () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <TableToolbar
        columns={[{ id: "col1", label: "Column 1", visible: true }]}
        onColumnToggle={onToggle}
        showDensity={false}
        showColumns={true}
      />
    );

    expect(screen.queryByText(/labels\.view|العرض/i)).not.toBeInTheDocument();
    expect(screen.getByText(/labels\.columns|الأعمدة/i)).toBeInTheDocument();
  });

  it("returns null when no search, no filterBar, and no utilities are active", () => {
    const { container } = renderWithProviders(
      <TableToolbar
        columns={[]}
        showViewOptions={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
