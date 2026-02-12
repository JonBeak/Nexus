-- Activate Push Thru validation profile
-- Profile was seeded with parameters but inactive; this enables it for production use
UPDATE vector_validation_profiles SET is_active = TRUE WHERE spec_type_key = 'push_thru';
