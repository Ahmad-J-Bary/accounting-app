-- Migration 130: Add depreciation_method column to existing fixed_assets table

ALTER TABLE fixed_assets ADD COLUMN depreciation_method TEXT NOT NULL DEFAULT 'StraightLine';
