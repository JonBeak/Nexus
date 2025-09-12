-- Fix customer_address_sequence field by adding auto-increment trigger
USE sign_manufacturing;

DELIMITER //
CREATE TRIGGER set_customer_address_sequence
    BEFORE INSERT ON customer_addresses
    FOR EACH ROW
BEGIN
    DECLARE max_seq INT DEFAULT 0;
    
    -- Check if sequence is already set (not null or 0)
    IF NEW.customer_address_sequence IS NULL OR NEW.customer_address_sequence = 0 THEN
        SELECT COALESCE(MAX(customer_address_sequence), 0) INTO max_seq
        FROM customer_addresses
        WHERE customer_id = NEW.customer_id;
        
        SET NEW.customer_address_sequence = max_seq + 1;
    END IF;
END//
DELIMITER ;

COMMIT;