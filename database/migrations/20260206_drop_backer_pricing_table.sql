-- Drop unused backer_pricing table
-- Real backer pricing is calculated from substrate_cut_pricing + hardcoded manufacturing constants
-- in backerPricingLookup.ts. This table was never read by the pricing engine.
DROP TABLE IF EXISTS backer_pricing;
