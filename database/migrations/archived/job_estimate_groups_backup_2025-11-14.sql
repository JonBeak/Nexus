*************************** 1. row ***************************
       Table: job_estimate_groups
Create Table: CREATE TABLE `job_estimate_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estimate_id` int NOT NULL,
  `group_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_order` int DEFAULT '0',
  `assembly_cost` decimal(10,2) DEFAULT '0.00',
  `assembly_description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_group_estimate` (`estimate_id`,`group_order`),
  CONSTRAINT `job_estimate_groups_ibfk_1` FOREIGN KEY (`estimate_id`) REFERENCES `job_estimates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
