/**
 * Order Template Types (Backend)
 * Phase 1.5.c.2 - Semantic specification keys for production orders
 *
 * This defines the structure of order_parts.specifications JSON
 * using semantic keys instead of field1-field12 from estimations.
 */

export interface OrderSpecifications {
  // Common fields
  quantity?: number;

  // Channel Letters
  type?: string;              // e.g., "3\" Reverse Channel", "Front Lit"
  height?: string;            // Letter height in inches
  depth?: string;             // Return depth in inches
  face_material?: string;     // e.g., "Acrylic", "Polycarbonate"
  return_material?: string;   // e.g., "Aluminum", "Painted Steel"
  vinyl_color?: string;       // e.g., "White", "Red"
  led_modules?: string;       // e.g., "White 5mm, Qty 64"
  power_supply?: string;      // e.g., "12V 5A Indoor"
  mounting_type?: string;     // e.g., "Flush", "Pins + Spacer"

  // LED Neon
  color?: string;             // e.g., "Warm White", "Red", "Blue"
  length?: string;            // Total length in feet
  installation?: string;      // e.g., "Clips", "Track", "Adhesive"

  // Substrate Cut
  material?: string;          // e.g., "ACM", "PVC", "Acrylic"
  width?: string;             // Width in inches
  finish?: string;            // e.g., "Routed edges", "Polished"

  // Vinyl
  vinyl_type?: string;        // e.g., "Translucent", "Opaque"
  application_method?: string; // e.g., "Wet apply", "Dry apply"

  // Painting
  paint_type?: string;        // e.g., "Automotive", "Powder Coat"
  paint_color?: string;       // e.g., "Black", "White"

  // Allow any semantic key for custom products
  [key: string]: any;
}
