-- =============================================================================
-- Migration: Seed Settings Data
-- Date: 2025-12-15
-- Description: Seeds all configuration data currently hard-coded in:
--   - /backend/web/src/services/taskGeneration/taskRules.ts (TASK_ORDER, TASK_ROLE_MAP)
--   - /frontend/web/src/config/specificationConstants.ts (all dropdown constants)
--   - /frontend/web/src/components/orders/tasksTable/roleColors.ts (role colors)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Seed Task Definitions (from taskRules.ts)
-- -----------------------------------------------------------------------------
INSERT INTO task_definitions (task_name, task_key, display_order, assigned_role, is_system) VALUES
('Vinyl Plotting', 'vinyl_plotting', 1, 'designer', TRUE),
('Sanding (320) before cutting', 'sanding_before_cutting', 2, 'painter', TRUE),
('Scuffing before cutting', 'scuffing_before_cutting', 3, 'painter', TRUE),
('Paint before cutting', 'paint_before_cutting', 4, 'painter', TRUE),
('Vinyl Face Before Cutting', 'vinyl_face_before_cutting', 5, 'vinyl_applicator', TRUE),
('Vinyl Wrap Return/Trim', 'vinyl_wrap_return_trim', 6, 'vinyl_applicator', TRUE),
('CNC Router Cut', 'cnc_router_cut', 7, 'cnc_router_operator', TRUE),
('Laser Cut', 'laser_cut', 8, 'manager', TRUE),
('Cut & Bend Return', 'cut_bend_return', 9, 'cut_bender_operator', TRUE),
('Cut & Bend Trim', 'cut_bend_trim', 10, 'cut_bender_operator', TRUE),
('Sanding (320) after cutting', 'sanding_after_cutting', 11, 'painter', TRUE),
('Scuffing after cutting', 'scuffing_after_cutting', 12, 'painter', TRUE),
('Paint After Cutting', 'paint_after_cutting', 13, 'painter', TRUE),
('Backer / Raceway Bending', 'backer_raceway_bending', 14, 'backer_raceway_fabricator', TRUE),
('Paint After Bending', 'paint_after_bending', 15, 'painter', TRUE),
('Vinyl Face After Cutting', 'vinyl_face_after_cutting', 16, 'vinyl_applicator', TRUE),
('Trim Fabrication', 'trim_fabrication', 17, 'trim_fabricator', TRUE),
('Return Fabrication', 'return_fabrication', 18, 'return_fabricator', TRUE),
('Return Gluing', 'return_gluing', 19, 'return_gluer', TRUE),
('Mounting Hardware', 'mounting_hardware', 20, 'mounting_assembler', TRUE),
('Face Assembly', 'face_assembly', 21, 'face_assembler', TRUE),
('LEDs', 'leds', 22, 'led_installer', TRUE),
('Backer / Raceway Fabrication', 'backer_raceway_fabrication', 23, 'backer_raceway_fabricator', TRUE),
('Vinyl after Fabrication', 'vinyl_after_fabrication', 24, 'vinyl_applicator', TRUE),
('Paint after Fabrication', 'paint_after_fabrication', 25, 'painter', TRUE),
('Assembly', 'assembly', 26, 'backer_raceway_assembler', TRUE);

-- -----------------------------------------------------------------------------
-- 2. Seed Production Roles (from roleColors.ts and types/orders.ts)
-- -----------------------------------------------------------------------------
INSERT INTO production_roles (role_key, display_name, display_order, color_hex, color_bg_class, color_text_class, is_system) VALUES
('designer', 'Designer', 1, '#3B82F6', 'bg-blue-100', 'text-blue-800', TRUE),
('vinyl_applicator', 'Vinyl Applicator', 2, '#8B5CF6', 'bg-violet-100', 'text-violet-800', TRUE),
('cnc_router_operator', 'CNC Router Operator', 3, '#10B981', 'bg-emerald-100', 'text-emerald-800', TRUE),
('cut_bender_operator', 'Cut & Bender Operator', 4, '#F59E0B', 'bg-amber-100', 'text-amber-800', TRUE),
('painter', 'Painter', 5, '#EF4444', 'bg-red-100', 'text-red-800', TRUE),
('led_installer', 'LED Installer', 6, '#06B6D4', 'bg-cyan-100', 'text-cyan-800', TRUE),
('trim_fabricator', 'Trim Fabricator', 7, '#84CC16', 'bg-lime-100', 'text-lime-800', TRUE),
('return_fabricator', 'Return Fabricator', 8, '#F97316', 'bg-orange-100', 'text-orange-800', TRUE),
('return_gluer', 'Return Gluer', 9, '#EC4899', 'bg-pink-100', 'text-pink-800', TRUE),
('mounting_assembler', 'Mounting Assembler', 10, '#6366F1', 'bg-indigo-100', 'text-indigo-800', TRUE),
('face_assembler', 'Face Assembler', 11, '#14B8A6', 'bg-teal-100', 'text-teal-800', TRUE),
('backer_raceway_fabricator', 'Backer/Raceway Fabricator', 12, '#A855F7', 'bg-purple-100', 'text-purple-800', TRUE),
('backer_raceway_assembler', 'Backer/Raceway Assembler', 13, '#0EA5E9', 'bg-sky-100', 'text-sky-800', TRUE),
('qc_packer', 'QC & Packer', 14, '#22C55E', 'bg-green-100', 'text-green-800', TRUE),
('manager', 'Manager', 15, '#6B7280', 'bg-gray-100', 'text-gray-800', TRUE);

-- -----------------------------------------------------------------------------
-- 3. Seed Specification Options (from specificationConstants.ts)
-- -----------------------------------------------------------------------------

-- Prefinished Colors
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('prefinished_colors', 'Prefinished Colors', 'White', 'white', 1, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Black', 'black', 2, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Red', 'red', 3, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Orange', 'orange', 4, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Yellow', 'yellow', 5, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Green', 'green', 6, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Blue', 'blue', 7, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Gold', 'gold', 8, TRUE),
('prefinished_colors', 'Prefinished Colors', 'Mill Finish', 'mill_finish', 9, TRUE);

-- Return Depths
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('return_depths', 'Return Depths', '3"', '3_inch', 1, TRUE),
('return_depths', 'Return Depths', '4"', '4_inch', 2, TRUE),
('return_depths', 'Return Depths', '5"', '5_inch', 3, TRUE),
('return_depths', 'Return Depths', 'Custom', 'custom', 4, TRUE);

-- Face Materials
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('face_materials', 'Face Materials', '2mm PC', '2mm_pc', 1, TRUE),
('face_materials', 'Face Materials', '3mm PC', '3mm_pc', 2, TRUE),
('face_materials', 'Face Materials', '3mm ACM', '3mm_acm', 3, TRUE),
('face_materials', 'Face Materials', '1mm Aluminum', '1mm_aluminum', 4, TRUE),
('face_materials', 'Face Materials', '12mm Acrylic', '12mm_acrylic', 5, TRUE),
('face_materials', 'Face Materials', '9mm Acrylic', '9mm_acrylic', 6, TRUE),
('face_materials', 'Face Materials', '4.5mm Acrylic', '4.5mm_acrylic', 7, TRUE);

-- Face Colors
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('face_colors', 'Face Colors', 'White', 'white', 1, TRUE),
('face_colors', 'Face Colors', 'Black', 'black', 2, TRUE),
('face_colors', 'Face Colors', 'White 2447', 'white_2447', 3, TRUE),
('face_colors', 'Face Colors', 'White 7328', 'white_7328', 4, TRUE),
('face_colors', 'Face Colors', 'Clear', 'clear', 5, TRUE),
('face_colors', 'Face Colors', 'Custom', 'custom', 6, TRUE);

-- Drain Hole Sizes
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('drain_hole_sizes', 'Drain Hole Sizes', '1/4"', 'quarter_inch', 1, TRUE),
('drain_hole_sizes', 'Drain Hole Sizes', 'Custom', 'custom', 2, TRUE);

-- Vinyl Applications
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('vinyl_applications', 'Vinyl Applications', 'Face, Full', 'face_full', 1, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Face, White Keyline', 'face_white_keyline', 2, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Face, Custom Cut', 'face_custom_cut', 3, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Return Wrap', 'return_wrap', 4, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Trim Wrap', 'trim_wrap', 5, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Return & Trim Wrap', 'return_trim_wrap', 6, TRUE),
('vinyl_applications', 'Vinyl Applications', 'Face & Return Wrap', 'face_return_wrap', 7, TRUE);

-- Digital Print Types
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('digital_print_types', 'Digital Print Types', 'Translucent', 'translucent', 1, TRUE),
('digital_print_types', 'Digital Print Types', 'Opaque', 'opaque', 2, TRUE),
('digital_print_types', 'Digital Print Types', 'Clear', 'clear', 3, TRUE),
('digital_print_types', 'Digital Print Types', 'Perforated', 'perforated', 4, TRUE);

-- Wire Gauges
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('wire_gauges', 'Wire Gauges', '18 AWG', '18_awg', 1, TRUE),
('wire_gauges', 'Wire Gauges', '22 AWG', '22_awg', 2, TRUE);

-- Cutting Methods
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('cutting_methods', 'Cutting Methods', 'Router', 'router', 1, TRUE),
('cutting_methods', 'Cutting Methods', 'Laser', 'laser', 2, TRUE);

-- Painting Components
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('painting_components', 'Painting Components', 'Face', 'face', 1, TRUE),
('painting_components', 'Painting Components', 'Return', 'return', 2, TRUE),
('painting_components', 'Painting Components', 'Trim', 'trim', 3, TRUE),
('painting_components', 'Painting Components', 'Return & Trim', 'return_trim', 4, TRUE),
('painting_components', 'Painting Components', 'Face & Return', 'face_return', 5, TRUE),
('painting_components', 'Painting Components', 'Frame', 'frame', 6, TRUE),
('painting_components', 'Painting Components', 'All Sides', 'all_sides', 7, TRUE);

-- Painting Timings
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('painting_timings', 'Painting Timings', 'Before Cutting', 'before_cutting', 1, TRUE),
('painting_timings', 'Painting Timings', 'After Cutting', 'after_cutting', 2, TRUE),
('painting_timings', 'Painting Timings', 'After Bending', 'after_bending', 3, TRUE),
('painting_timings', 'Painting Timings', 'After Fabrication', 'after_fabrication', 4, TRUE);

-- Mounting Types
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('mounting_types', 'Mounting Types', 'Pins', 'pins', 1, TRUE),
('mounting_types', 'Mounting Types', 'Pins + Spacers', 'pins_spacers', 2, TRUE),
('mounting_types', 'Mounting Types', 'Pins + Inserts', 'pins_inserts', 3, TRUE),
('mounting_types', 'Mounting Types', 'Pins + Spacers + Inserts', 'pins_spacers_inserts', 4, TRUE),
('mounting_types', 'Mounting Types', 'D-Tape', 'd_tape', 5, TRUE),
('mounting_types', 'Mounting Types', 'Nylon Pins', 'nylon_pins', 6, TRUE),
('mounting_types', 'Mounting Types', 'Nylon Pins + Spacers', 'nylon_pins_spacers', 7, TRUE),
('mounting_types', 'Mounting Types', 'SS Pins', 'ss_pins', 8, TRUE),
('mounting_types', 'Mounting Types', 'SS Pins + Spacers', 'ss_pins_spacers', 9, TRUE),
('mounting_types', 'Mounting Types', 'Stand offs', 'stand_offs', 10, TRUE);

-- Pin Lengths
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('pin_lengths', 'Pin Lengths', '2"', '2_inch', 1, TRUE),
('pin_lengths', 'Pin Lengths', '4"', '4_inch', 2, TRUE),
('pin_lengths', 'Pin Lengths', '6"', '6_inch', 3, TRUE);

-- Spacer Lengths
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('spacer_lengths', 'Spacer Lengths', '0.5"', 'half_inch', 1, TRUE),
('spacer_lengths', 'Spacer Lengths', '1"', '1_inch', 2, TRUE),
('spacer_lengths', 'Spacer Lengths', '1.5"', '1_5_inch', 3, TRUE);

-- Material Colours
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('material_colours', 'Material Colours', 'Matte White', 'matte_white', 1, TRUE),
('material_colours', 'Material Colours', 'Matte Black', 'matte_black', 2, TRUE),
('material_colours', 'Material Colours', 'Black', 'black', 3, TRUE),
('material_colours', 'Material Colours', 'Opaque White', 'opaque_white', 4, TRUE),
('material_colours', 'Material Colours', '2447 White', '2447_white', 5, TRUE),
('material_colours', 'Material Colours', '7328 White', '7328_white', 6, TRUE),
('material_colours', 'Material Colours', 'Clear', 'clear', 7, TRUE),
('material_colours', 'Material Colours', '1" Galv Steel Square Tube', '1_galv_steel_square_tube', 8, TRUE);

-- Extrusion Colours
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('extrusion_colours', 'Extrusion Colours', 'White', 'white', 1, TRUE),
('extrusion_colours', 'Extrusion Colours', 'Gray', 'gray', 2, TRUE),
('extrusion_colours', 'Extrusion Colours', 'Black', 'black', 3, TRUE);

-- Back Materials
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('back_materials', 'Back Materials', '2mm ACM', '2mm_acm', 1, TRUE),
('back_materials', 'Back Materials', '2mm White PC', '2mm_white_pc', 2, TRUE),
('back_materials', 'Back Materials', '2mm Clear PC', '2mm_clear_pc', 3, TRUE),
('back_materials', 'Back Materials', '3mm White PC', '3mm_white_pc', 4, TRUE);

-- Box Materials
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('box_materials', 'Box Materials', '3mm ACM', '3mm_acm', 1, TRUE),
('box_materials', 'Box Materials', '1mm Aluminum', '1mm_aluminum', 2, TRUE);

-- Box Colours
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('box_colours', 'Box Colours', 'Matte Black', 'matte_black', 1, TRUE),
('box_colours', 'Box Colours', 'White', 'white', 2, TRUE),
('box_colours', 'Box Colours', 'Red', 'red', 3, TRUE);

-- Box Fabrication
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('box_fabrication', 'Box Fabrication', '2" Angle Return', '2_angle_return', 1, TRUE),
('box_fabrication', 'Box Fabrication', 'Folded', 'folded', 2, TRUE);

-- Push Thru Thicknesses
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('push_thru_thicknesses', 'Push Thru Thicknesses', '12mm', '12mm', 1, TRUE),
('push_thru_thicknesses', 'Push Thru Thicknesses', '9mm', '9mm', 2, TRUE),
('push_thru_thicknesses', 'Push Thru Thicknesses', '6mm', '6mm', 3, TRUE),
('push_thru_thicknesses', 'Push Thru Thicknesses', '0mm (Knockout)', '0mm_knockout', 4, TRUE);

-- Push Thru Colours
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('push_thru_colours', 'Push Thru Colours', '2447 White', '2447_white', 1, TRUE),
('push_thru_colours', 'Push Thru Colours', 'Clear', 'clear', 2, TRUE);

-- Neon Base Thicknesses
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('neon_base_thicknesses', 'Neon Base Thicknesses', '12mm', '12mm', 1, TRUE),
('neon_base_thicknesses', 'Neon Base Thicknesses', '9mm', '9mm', 2, TRUE),
('neon_base_thicknesses', 'Neon Base Thicknesses', '6mm', '6mm', 3, TRUE);

-- Neon Base Materials
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('neon_base_materials', 'Neon Base Materials', 'Acrylic', 'acrylic', 1, TRUE),
('neon_base_materials', 'Neon Base Materials', 'PVC', 'pvc', 2, TRUE);

-- Neon Base Colours
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('neon_base_colours', 'Neon Base Colours', 'Clear', 'clear', 1, TRUE),
('neon_base_colours', 'Neon Base Colours', '2447 White', '2447_white', 2, TRUE),
('neon_base_colours', 'Neon Base Colours', '7328 White', '7328_white', 3, TRUE),
('neon_base_colours', 'Neon Base Colours', 'Opaque White', 'opaque_white', 4, TRUE),
('neon_base_colours', 'Neon Base Colours', 'Black', 'black', 5, TRUE),
('neon_base_colours', 'Neon Base Colours', 'White', 'white', 6, TRUE);

-- Neon LED Stroke Widths
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('neon_led_stroke_widths', 'Neon LED Stroke Widths', '8mm', '8mm', 1, TRUE),
('neon_led_stroke_widths', 'Neon LED Stroke Widths', '6mm', '6mm', 2, TRUE);

-- Neon LED Colours
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('neon_led_colours', 'Neon LED Colours', 'Pure White', 'pure_white', 1, TRUE),
('neon_led_colours', 'Neon LED Colours', 'Warm White', 'warm_white', 2, TRUE),
('neon_led_colours', 'Neon LED Colours', 'Yellow', 'yellow', 3, TRUE),
('neon_led_colours', 'Neon LED Colours', 'Orange', 'orange', 4, TRUE),
('neon_led_colours', 'Neon LED Colours', 'Red', 'red', 5, TRUE),
('neon_led_colours', 'Neon LED Colours', 'Green', 'green', 6, TRUE),
('neon_led_colours', 'Neon LED Colours', 'Blue', 'blue', 7, TRUE),
('neon_led_colours', 'Neon LED Colours', 'Purple', 'purple', 8, TRUE);

-- D-Tape Thicknesses
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('d_tape_thicknesses', 'D-Tape Thicknesses', '62 MIL (Thick)', '62_mil_thick', 1, TRUE),
('d_tape_thicknesses', 'D-Tape Thicknesses', '45 MIL (Medium)', '45_mil_medium', 2, TRUE),
('d_tape_thicknesses', 'D-Tape Thicknesses', '16 MIL (Thin)', '16_mil_thin', 3, TRUE);

-- Pin Types
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('pin_types', 'Pin Types', '2" Pins', '2_pins', 1, TRUE),
('pin_types', 'Pin Types', '4" Pins', '4_pins', 2, TRUE),
('pin_types', 'Pin Types', '6" Pins', '6_pins', 3, TRUE),
('pin_types', 'Pin Types', '4" Nylon', '4_nylon', 4, TRUE),
('pin_types', 'Pin Types', '4" SS', '4_ss', 5, TRUE),
('pin_types', 'Pin Types', '6" SS', '6_ss', 6, TRUE),
('pin_types', 'Pin Types', '8" SS', '8_ss', 7, TRUE),
('pin_types', 'Pin Types', 'Stand Offs', 'stand_offs', 8, TRUE);

-- Spacer Types
INSERT INTO specification_options (category, category_display_name, option_value, option_key, display_order, is_system) VALUES
('spacer_types', 'Spacer Types', '0.5" Pad', 'half_pad', 1, TRUE),
('spacer_types', 'Spacer Types', '1" Spacer', '1_spacer', 2, TRUE),
('spacer_types', 'Spacer Types', '1.5" Spacer', '1_5_spacer', 3, TRUE),
('spacer_types', 'Spacer Types', '0.5" Pad + Insert', 'half_pad_insert', 4, TRUE),
('spacer_types', 'Spacer Types', '1" Spacer + Insert', '1_spacer_insert', 5, TRUE),
('spacer_types', 'Spacer Types', '1.5" Spacer + Insert', '1_5_spacer_insert', 6, TRUE),
('spacer_types', 'Spacer Types', '0.5" Pad + Rivnut', 'half_pad_rivnut', 7, TRUE),
('spacer_types', 'Spacer Types', '1" Spacer + Rivnut', '1_spacer_rivnut', 8, TRUE),
('spacer_types', 'Spacer Types', '1.5" Spacer + Rivnut', '1_5_spacer_rivnut', 9, TRUE),
('spacer_types', 'Spacer Types', 'Stand off', 'stand_off', 10, TRUE);

-- -----------------------------------------------------------------------------
-- 4. Seed Settings Categories (for navigation)
-- -----------------------------------------------------------------------------
INSERT INTO settings_categories (category_key, display_name, description, icon_name, route_path, display_order, required_role) VALUES
('specifications', 'Specification Options', 'Manage dropdown options for order specifications', 'List', '/settings/specifications', 1, 'manager'),
('tasks', 'Task Configuration', 'Configure task order and role assignments', 'CheckSquare', '/settings/tasks', 2, 'owner'),
('painting_matrix', 'Painting Matrix', 'Configure painting task rules by product type', 'Grid3X3', '/settings/painting-matrix', 3, 'owner'),
('roles', 'Production Roles', 'Manage production roles and colors', 'Users', '/settings/roles', 4, 'owner'),
('email_templates', 'Email Templates', 'Customize email templates for orders', 'Mail', '/settings/email-templates', 5, 'manager'),
('audit_log', 'Audit Log', 'View history of settings changes', 'History', '/settings/audit-log', 6, 'owner');

-- -----------------------------------------------------------------------------
-- 5. Seed Email Templates
-- -----------------------------------------------------------------------------
INSERT INTO email_templates (template_key, template_name, description, subject, body, available_variables) VALUES
('deposit_request', '50% Deposit Request', 'Email sent when requesting deposit payment before production',
'Invoice #{orderNumber} - Deposit Required | {customerName}',
'Dear {pointPersonName},

Thank you for your order #{orderNumber} with SignHouse.

Before we begin production, a 50% deposit of {depositAmount} is required.

Order Details:
- Order Number: {orderNumber}
- Order Name: {orderName}
- Total Amount: {invoiceTotal}
- Deposit Required: {depositAmount}

Please remit payment at your earliest convenience. You can view and pay your invoice here:
{qbInvoiceUrl}

If you have any questions, please don''t hesitate to contact us.

Thank you for your business!

SignHouse Team',
'["orderNumber", "orderName", "customerName", "pointPersonName", "invoiceTotal", "depositAmount", "dueDate", "qbInvoiceUrl"]'),

('full_invoice', 'Full Invoice', 'Email sent with the full invoice when order is ready to ship',
'Invoice #{orderNumber} | {customerName}',
'Dear {pointPersonName},

Your order #{orderNumber} is ready!

Order Details:
- Order Number: {orderNumber}
- Order Name: {orderName}
- Total Amount: {invoiceTotal}
- Due Date: {dueDate}

You can view and pay your invoice here:
{qbInvoiceUrl}

Thank you for your business!

SignHouse Team',
'["orderNumber", "orderName", "customerName", "pointPersonName", "invoiceTotal", "dueDate", "qbInvoiceUrl"]');
