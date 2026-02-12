-- Activate Push Thru validation profile and add lexan area/clearance parameters
UPDATE vector_validation_profiles
SET is_active = TRUE,
    parameters = JSON_SET(
      parameters,
      '$.max_cutout_area_ratio', 0.67,
      '$.min_lexan_cutout_clearance_inches', 0.25
    )
WHERE spec_type_key = 'push_thru';
