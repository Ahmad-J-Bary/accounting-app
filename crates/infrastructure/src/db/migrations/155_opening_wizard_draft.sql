-- Phase 4: per-company opening-balance wizard draft. Stores the frontend
-- editor state (cutover date, source fields, notes, cash/bank/loan rows,
-- manual asset/liability/equity lines, fixed-asset opening overrides, inventory
-- inputs, residual classification, first-fiscal-period window, current step) as
-- JSON so the user can Save -> Exit -> Continue Later without losing mid-wizard
-- work. The opening-balance migration entity is untouched: a persistent Draft
-- migration is still created at the review step. This table only carries the
-- resumable editor state. Single-company app: one row id='default'.
CREATE TABLE IF NOT EXISTS opening_wizard_draft (
    id TEXT PRIMARY KEY CHECK (id = 'default'),
    company_id TEXT,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);