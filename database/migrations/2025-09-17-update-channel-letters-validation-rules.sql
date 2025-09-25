-- Update Channel Letters (product_type_id = 1) validation rules to use raw field ids
-- Aligns stored configuration with frontend GridJobBuilder expectations (field1…field10)
-- and removes the need for client-side remapping/normalization.

UPDATE product_types
SET 
  validation_rules = JSON_OBJECT(
    'field1', JSON_OBJECT(
      'function', 'non_empty',
      'error_level', 'warning',
      'field_category', 'complete_set'
    ),
    'field2', JSON_OBJECT(
      'function', 'float_or_groups',
      'error_level', 'error',
      'field_category', 'complete_set',
      'params', JSON_OBJECT(
        'group_separator', '. . . . . ',
        'number_separator', ',',
        'allow_negative', FALSE,
        'min_value', 0
      )
    ),
    'field3', JSON_OBJECT(
      'function', 'led_override',
      'error_level', 'mixed',
      'field_category', 'sufficient',
      'params', JSON_OBJECT(
        'accepts', JSON_ARRAY('float', 'yes', 'no')
      )
    ),
    'field4', JSON_OBJECT(
      'function', 'ul_override',
      'error_level', 'mixed',
      'field_category', 'sufficient',
      'params', JSON_OBJECT(
        'accepts', JSON_ARRAY('float', 'yes', 'no', 'currency')
      )
    ),
    'field5', JSON_OBJECT(
      'function', 'float',
      'error_level', 'error',
      'field_category', 'sufficient',
      'params', JSON_OBJECT(
        'min', 0,
        'allow_negative', FALSE,
        'decimal_places', 2
      )
    ),
    'field6', JSON_OBJECT(
      'function', 'float',
      'error_level', 'mixed',
      'field_category', 'supplementary',
      'params', JSON_OBJECT(
        'min', 0,
        'allow_negative', FALSE,
        'decimal_places', 2
      )
    ),
    'field8', JSON_OBJECT(
      'function', 'led_type',
      'error_level', 'warning',
      'field_category', 'supplementary'
    ),
    'field9', JSON_OBJECT(
      'function', 'ps_override',
      'error_level', 'mixed',
      'field_category', 'sufficient',
      'params', JSON_OBJECT(
        'accepts', JSON_ARRAY('float', 'yes', 'no')
      )
    ),
    'field10', JSON_OBJECT(
      'function', 'ps_type',
      'error_level', 'warning',
      'field_category', 'supplementary'
    )
  ),
  updated_at = NOW()
WHERE id = 1;
