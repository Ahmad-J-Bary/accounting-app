-- Migration 026: Material Unit and Packing
-- Add unit of measure and packaging factor to materials table

ALTER TABLE materials ADD COLUMN unit TEXT NOT NULL DEFAULT 'قطعة';
ALTER TABLE materials ADD COLUMN packaging_factor TEXT NOT NULL DEFAULT '1';
