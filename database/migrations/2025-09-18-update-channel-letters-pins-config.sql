-- Update Channel Letters pins and wiring configuration
-- - Field5 remains numeric pins count
-- - Field6 becomes Pins Type dropdown
-- - Field7 becomes Extra Wire length

UPDATE product_types
SET
  field_prompts = JSON_SET(
    COALESCE(field_prompts, JSON_OBJECT()),
    '$.field5', 'Pins #',
    '$.field5_enabled', true,
    '$.field6', 'Pins Type',
    '$.field6_enabled', true,
    '$.field7', 'Extra Wire (ft)',
    '$.field7_enabled', true
  ),
  static_options = JSON_MERGE_PATCH(
    COALESCE(static_options, JSON_OBJECT()),
    JSON_OBJECT(
      'field6', JSON_ARRAY('Pins', 'Pins + Spacer', 'Pins + Rivnut', 'Pins + Rivnut + Spacer')
    )
  ),
  validation_rules = JSON_MERGE_PATCH(
    COALESCE(validation_rules, JSON_OBJECT()),
    JSON_OBJECT(
      'field5', JSON_OBJECT(
        'function', 'float',
        'error_level', 'error',
        'field_category', 'sufficient',
        'params', JSON_OBJECT(
          'min', 0,
          'allow_negative', false,
          'decimal_places', 2
        )
      ),
      'field6', JSON_OBJECT(
        'function', 'non_empty',
        'error_level', 'warning',
        'field_category', 'supplementary'
      ),
      'field7', JSON_OBJECT(
        'function', 'float',
        'error_level', 'mixed',
        'field_category', 'supplementary',
        'params', JSON_OBJECT(
          'min', 0,
          'allow_negative', false,
          'decimal_places', 2
        )
      )
    )
  ),
  updated_at = NOW()
WHERE id = 1;
