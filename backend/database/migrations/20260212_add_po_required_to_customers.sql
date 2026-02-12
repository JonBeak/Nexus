-- Migration: Add po_required column to customers table
-- Date: 2026-02-12
-- Purpose: Track which customers require a Purchase Order number when converting estimates to orders

ALTER TABLE customers ADD COLUMN po_required TINYINT(1) NOT NULL DEFAULT 0 AFTER hide_company_name;
