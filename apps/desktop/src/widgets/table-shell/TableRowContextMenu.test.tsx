import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableRowContextMenu } from "./TableRowContextMenu";
import type { RowActionDescriptor } from "@shared/types/row-actions";
import { Eye, Edit, Trash2 } from "lucide-react";

interface TestRow {
  id: string;
  name: string;
  isReadOnly?: boolean;
}

describe("TableRowContextMenu", () => {
  const sampleRow: TestRow = { id: "1", name: "Sample Item" };

  it("renders trigger and opens menu on right-click contextmenu event", () => {
    const handleView = vi.fn();
    const handleEdit = vi.fn();

    const actions: RowActionDescriptor<TestRow>[] = [
      { id: "view", label: "View Details", icon: Eye, onClick: handleView },
      { id: "edit", label: "Edit Record", icon: Edit, onClick: handleEdit },
    ];

    render(
      <TableRowContextMenu actions={actions} row={sampleRow}>
        <div data-testid="table-row">Row Content</div>
      </TableRowContextMenu>
    );

    const row = screen.getByTestId("table-row");
    expect(row).toBeInTheDocument();

    // Trigger right click
    fireEvent.contextMenu(row);

    expect(screen.getByText("View Details")).toBeInTheDocument();
    expect(screen.getByText("Edit Record")).toBeInTheDocument();

    fireEvent.click(screen.getByText("View Details"));
    expect(handleView).toHaveBeenCalledWith(sampleRow);
  });

  it("filters out hidden actions based on predicate", () => {
    const actions: RowActionDescriptor<TestRow>[] = [
      { id: "view", label: "Always Visible", onClick: vi.fn() },
      { id: "edit", label: "Hidden Action", hidden: (r) => r.isReadOnly === true, onClick: vi.fn() },
    ];

    render(
      <TableRowContextMenu actions={actions} row={{ id: "2", name: "Locked", isReadOnly: true }}>
        <div data-testid="table-row">Locked Row</div>
      </TableRowContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("table-row"));

    expect(screen.getByText("Always Visible")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Action")).not.toBeInTheDocument();
  });

  it("renders disabled state for actions with disabled predicate", () => {
    const actions: RowActionDescriptor<TestRow>[] = [
      { id: "edit", label: "Disabled Action", disabled: true, onClick: vi.fn() },
    ];

    render(
      <TableRowContextMenu actions={actions} row={sampleRow}>
        <div data-testid="table-row">Sample Row</div>
      </TableRowContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("table-row"));

    const item = screen.getByTestId("row-action-edit");
    expect(item).toHaveAttribute("data-disabled");
  });

  it("renders destructive action with destructive styling", () => {
    const handleDelete = vi.fn();
    const actions: RowActionDescriptor<TestRow>[] = [
      { id: "delete", label: "Delete Record", icon: Trash2, destructive: true, onClick: handleDelete },
    ];

    render(
      <TableRowContextMenu actions={actions} row={sampleRow}>
        <div data-testid="table-row">Row With Delete</div>
      </TableRowContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("table-row"));

    const deleteItem = screen.getByTestId("row-action-delete");
    expect(deleteItem.className).toContain("text-destructive");
  });
});
