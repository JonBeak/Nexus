-- Add "Digital Print" as a product archetype under the "Print Media" category
-- This gives Digital Print the same treatment as Vinyl in the product type dropdown
INSERT INTO product_archetypes (name, category_id, unit_of_measure, description, is_active)
VALUES ('Digital Print', 9, 'sq_ft', 'Digital print media - translucent, opaque, clear, perforated substrates', TRUE);
