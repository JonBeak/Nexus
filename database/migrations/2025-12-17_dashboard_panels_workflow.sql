-- =============================================
-- Dashboard Panel System - Workflow Panels
-- Created: 2025-12-17
-- Purpose: Add workflow-focused panels with days tracking and actions
-- =============================================

-- 13. Job Details Setup (with days tracking)
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Job Details Setup',
  'job_details_setup',
  'New orders requiring job details configuration',
  'Settings',
  'bg-slate-100 text-slate-800',
  13,
  15,
  '{"statuses": ["job_details_setup"], "showDaysInStatus": true, "sortByDaysInStatus": true}',
  TRUE
);

-- 14. Pending Confirmation (with days tracking and actions)
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Pending Confirmation',
  'pending_confirmation',
  'Orders awaiting customer confirmation',
  'UserCheck',
  'bg-amber-100 text-amber-800',
  14,
  15,
  '{"statuses": ["pending_confirmation"], "showDaysInStatus": true, "sortByDaysInStatus": true, "actions": ["send_reminder", "mark_approved"]}',
  TRUE
);

-- 15. Pending Files Creation (with days tracking)
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Pending Files Creation',
  'pending_files_creation',
  'Orders requiring production file creation',
  'FilePlus2',
  'bg-blue-100 text-blue-800',
  15,
  15,
  '{"statuses": ["pending_production_files_creation"], "showDaysInStatus": true, "sortByDaysInStatus": true}',
  TRUE
);

-- 16. Pending Files Approval (with days tracking and approve action)
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Pending Files Approval',
  'pending_files_approval',
  'Orders with production files awaiting approval',
  'FileCheck2',
  'bg-green-100 text-green-800',
  16,
  15,
  '{"statuses": ["pending_production_files_approval"], "showDaysInStatus": true, "sortByDaysInStatus": true, "actions": ["approve_files"]}',
  TRUE
);
