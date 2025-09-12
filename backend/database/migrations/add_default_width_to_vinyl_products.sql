-- Add default_width column to vinyl_products table
-- This allows storing default width for each product combination

ALTER TABLE vinyl_products 
ADD COLUMN default_width DECIMAL(5,2) DEFAULT NULL 
COMMENT 'Default width in inches for this product';

-- Create index for performance
CREATE INDEX idx_vinyl_products_default_width ON vinyl_products(default_width);

-- Update some common products with typical widths (example data)
-- These can be updated by users through the interface
UPDATE vinyl_products SET default_width = 48.0 WHERE brand = '3M' AND series = '180mC';
UPDATE vinyl_products SET default_width = 54.0 WHERE brand = 'Avery' AND series = 'MPI1105';
UPDATE vinyl_products SET default_width = 60.0 WHERE brand = 'Oracal' AND series = '651';