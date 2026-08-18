// Route-level lifecycle gating (`OpeningTransactionGate` in
// ErpRoutes) plus deep-link / direct-URL access in every lifecycle state.
// The page-level redirects (opening pages closing once the workflow is sealed)
// are asserted separately in the real-page tests; here the page modules are
// lightweight stubs so we exercise the ROUTES + GATE only.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@modules/dashboard/pages/dashboard", () => ({
  default: () => <div>DASHBOARD_PAGE</div>,
}));
vi.mock("@modules/accounting/journal/pages/journal", () => ({
  default: () => <div>JOURNAL_PAGE</div>,
}));
vi.mock("@modules/invoicing/pages/salesInvoices", () => ({
  default: () => <div>SALES_INVOICES_PAGE</div>,
}));
vi.mock("@modules/opening-balance/pages/openingBalanceMigration", () => ({
  default: () => <div>MIGRATION_PAGE</div>,
}));
vi.mock("@modules/partners/pages/PartyPage", () => ({
  default: () => <div>CUSTOMERS_PAGE</div>,
}));

import { ErpRoutes } from "@app/router/ErpRoutes";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { START_MODE_NEW, START_MODE_EXISTING } from "@modules/opening-balance/lib/wizard-types";

interface SeedOptions {
  mode?: "existing" | "new";
  migrations?: { status: string }[];
  periods?: unknown[];
}

function seedLifecycle(qc: QueryClient, opts: SeedOptions = {}) {
  const { mode = "existing", migrations = [], periods = [] } = opts;
  qc.setQueryData(QUERY_KEYS.settings, {
    accounting_start_mode: mode === "new" ? START_MODE_NEW : START_MODE_EXISTING,
  });
  qc.setQueryData(QUERY_KEYS.openingBalanceMigrations, migrations);
  qc.setQueryData(QUERY_KEYS.fiscalPeriods, periods);
}

function renderAt(path: string, seed: SeedOptions) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  seedLifecycle(qc, seed);
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={qc}>
        <ErpRoutes />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return qc;
}

const midOpening: SeedOptions = { migrations: [{ status: "Draft" }] };
const locked: SeedOptions = { migrations: [{ status: "Locked" }] };
const active: SeedOptions = { migrations: [{ status: "Locked" }], periods: [{}] };

describe("OpeningTransactionGate (route-level)", () => {
  it("blocks /journal while EXISTING is mid-opening → redirects to the migration page", () => {
    renderAt("/journal", midOpening);
    expect(screen.getByText("MIGRATION_PAGE")).toBeInTheDocument();
    expect(screen.queryByText("JOURNAL_PAGE")).not.toBeInTheDocument();
  });

  it("blocks deep-linked /sales-invoices too (direct URL access)", () => {
    renderAt("/sales-invoices", midOpening);
    expect(screen.getByText("MIGRATION_PAGE")).toBeInTheDocument();
    expect(screen.queryByText("SALES_INVOICES_PAGE")).not.toBeInTheDocument();
  });

  it("never blocks master data during the opening window", () => {
    renderAt("/customers", midOpening);
    expect(screen.getByText("CUSTOMERS_PAGE")).toBeInTheDocument();
  });

  it("lets /journal through once the migration is Locked (OPENING_LOCKED)", () => {
    renderAt("/journal", locked);
    expect(screen.getByText("JOURNAL_PAGE")).toBeInTheDocument();
  });

  it("lets /journal through once fully ACTIVE", () => {
    renderAt("/journal", active);
    expect(screen.getByText("JOURNAL_PAGE")).toBeInTheDocument();
  });

  it("never blocks a NEW company regardless of stray migrations", () => {
    renderAt("/journal", { mode: "new", migrations: [{ status: "Draft" }] });
    expect(screen.getByText("JOURNAL_PAGE")).toBeInTheDocument();
  });

  it("stays permissive while lifecycle queries are still loading (no flash-gating)", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // settings known EXISTING, but migrations/periods never resolve
    qc.setQueryData(QUERY_KEYS.settings, {
      accounting_start_mode: START_MODE_EXISTING,
    });
    render(
      <MemoryRouter initialEntries={["/journal"]}>
        <QueryClientProvider client={qc}>
          <ErpRoutes />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("JOURNAL_PAGE")).toBeInTheDocument();
  });

  it("refresh-equivalent deep link: a direct mid-opening URL settles on the migration page", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    seedLifecycle(qc, midOpening);
    render(
      <MemoryRouter initialEntries={["/journal"]}>
        <QueryClientProvider client={qc}>
          <ErpRoutes />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("MIGRATION_PAGE", {}, { timeout: 2000 })).toBeInTheDocument();
  });
});