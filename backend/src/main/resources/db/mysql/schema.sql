-- MySQL 8.0.16+ / UTF-8 / complete application schema.
-- Select an empty application database before executing this file.
-- No database selection, DROP statements, accounts or sample business data.
-- CREATE IF NOT EXISTS is for fresh installation; use migrations for an existing schema.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `user` (
  `user_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` VARCHAR(50) NOT NULL COMMENT '登录账号',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'BCrypt密码哈希',
  `nickname` VARCHAR(60) DEFAULT NULL COMMENT '昵称',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='普通用户（无管理员角色）';

CREATE TABLE IF NOT EXISTS `trip` (
  `trip_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(120) NOT NULL COMMENT '旅行名称',
  `destination` VARCHAR(120) NOT NULL COMMENT '主要目的地',
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `total_budget` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '用户预算',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`trip_id`),
  KEY `idx_trip_user_date` (`user_id`, `start_date`),
  CONSTRAINT `fk_trip_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_trip_dates` CHECK (`end_date` >= `start_date`),
  CONSTRAINT `ck_trip_budget` CHECK (`total_budget` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='旅行计划';

CREATE TABLE IF NOT EXISTS `attraction` (
  `attraction_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `created_by` BIGINT UNSIGNED NOT NULL COMMENT '创建用户',
  `name` VARCHAR(120) NOT NULL,
  `city` VARCHAR(80) NOT NULL,
  `category` VARCHAR(40) DEFAULT NULL COMMENT '自填类别',
  `description` TEXT COMMENT '自填说明',
  `suggested_duration_minutes` SMALLINT UNSIGNED DEFAULT NULL COMMENT '自填建议时长',
  `reference_ticket_price` DECIMAL(10,2) DEFAULT NULL COMMENT '用户自填估算门票（非实时价格）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`attraction_id`),
  KEY `idx_attraction_city_name` (`city`, `name`),
  KEY `idx_attraction_created_by` (`created_by`),
  CONSTRAINT `fk_attraction_user` FOREIGN KEY (`created_by`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_attraction_duration` CHECK (`suggested_duration_minutes` IS NULL OR `suggested_duration_minutes` > 0),
  CONSTRAINT `ck_attraction_ticket` CHECK (`reference_ticket_price` IS NULL OR `reference_ticket_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户独立录入的景点';

CREATE TABLE IF NOT EXISTS `favorite` (
  `favorite_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `attraction_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`favorite_id`),
  UNIQUE KEY `uk_favorite_user_attraction` (`user_id`, `attraction_id`),
  KEY `idx_favorite_attraction` (`attraction_id`),
  CONSTRAINT `fk_favorite_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_favorite_attraction` FOREIGN KEY (`attraction_id`) REFERENCES `attraction` (`attraction_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户收藏自建景点';

CREATE TABLE IF NOT EXISTS `trip_day` (
  `day_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `trip_date` DATE NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`day_id`),
  UNIQUE KEY `uk_trip_day` (`trip_id`, `trip_date`),
  CONSTRAINT `fk_trip_day_trip` FOREIGN KEY (`trip_id`) REFERENCES `trip` (`trip_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='旅行日期';

CREATE TABLE IF NOT EXISTS `itinerary_item` (
  `item_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `day_id` BIGINT UNSIGNED NOT NULL,
  `attraction_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '可选引用自建景点',
  `item_name` VARCHAR(150) NOT NULL COMMENT '独立保存用户确认的活动名',
  `start_time` TIME DEFAULT NULL,
  `end_time` TIME DEFAULT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 1,
  `transportation` VARCHAR(60) DEFAULT NULL,
  `estimated_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '估算，不等于消费',
  `source_type` VARCHAR(12) NOT NULL DEFAULT 'MANUAL' COMMENT 'MANUAL/AI',
  `note` VARCHAR(500) DEFAULT NULL,
  PRIMARY KEY (`item_id`),
  KEY `idx_item_day_order` (`day_id`, `sort_order`, `item_id`),
  KEY `idx_item_attraction` (`attraction_id`),
  CONSTRAINT `fk_item_trip_day` FOREIGN KEY (`day_id`) REFERENCES `trip_day` (`day_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_item_attraction` FOREIGN KEY (`attraction_id`) REFERENCES `attraction` (`attraction_id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_item_cost` CHECK (`estimated_cost` >= 0),
  CONSTRAINT `ck_item_source` CHECK (`source_type` IN ('MANUAL','AI')),
  CONSTRAINT `ck_item_time` CHECK (`start_time` IS NULL OR `end_time` IS NULL OR `end_time` >= `start_time`),
  CONSTRAINT `ck_item_order` CHECK (`sort_order` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='手动或AI确认的行程项目';

CREATE TABLE IF NOT EXISTS `expense` (
  `expense_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `category` VARCHAR(20) NOT NULL COMMENT 'FOOD/TRANSPORT/HOTEL/TICKET/SHOPPING/OTHER',
  `amount` DECIMAL(12,2) NOT NULL,
  `spent_on` DATE NOT NULL,
  `description` VARCHAR(300) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`expense_id`),
  KEY `idx_expense_trip_date` (`trip_id`, `spent_on`),
  KEY `idx_expense_trip_category` (`trip_id`, `category`),
  CONSTRAINT `fk_expense_trip` FOREIGN KEY (`trip_id`) REFERENCES `trip` (`trip_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `ck_expense_amount` CHECK (`amount` > 0),
  CONSTRAINT `ck_expense_category` CHECK (`category` IN ('FOOD','TRANSPORT','HOTEL','TICKET','SHOPPING','OTHER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='实际旅行消费';

CREATE TABLE IF NOT EXISTS `ai_plan_record` (
  `ai_plan_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `trip_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '生成时可暂未关联旅行',
  `request_json` JSON NOT NULL COMMENT '用户输入的规划条件',
  `response_json` JSON DEFAULT NULL COMMENT '模型返回并校验的草稿',
  `estimated_total` DECIMAL(12,2) DEFAULT NULL COMMENT 'AI预估费用',
  `status` VARCHAR(12) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/SAVED/FAILED',
  `error_message` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `saved_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`ai_plan_id`),
  KEY `idx_ai_user_created` (`user_id`, `created_at`),
  KEY `idx_ai_trip` (`trip_id`),
  CONSTRAINT `fk_ai_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_ai_trip` FOREIGN KEY (`trip_id`) REFERENCES `trip` (`trip_id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `ck_ai_estimated` CHECK (`estimated_total` IS NULL OR `estimated_total` >= 0),
  CONSTRAINT `ck_ai_status` CHECK (`status` IN ('DRAFT','SAVED','FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI生成的规划草稿及历史';

CREATE TABLE IF NOT EXISTS `ai_conversation` (
  `conversation_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `conditions_json` JSON NOT NULL,
  `current_plan_id` BIGINT UNSIGNED DEFAULT NULL,
  `current_days_json` JSON DEFAULT NULL,
  `memory` TEXT NOT NULL,
  `version` BIGINT NOT NULL DEFAULT 0,
  `active_request_id` VARCHAR(64) DEFAULT NULL,
  `started_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`),
  KEY `idx_chat_user_updated` (`user_id`, `updated_at`),
  CONSTRAINT `fk_chat_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_plan` FOREIGN KEY (`current_plan_id`) REFERENCES `ai_plan_record` (`ai_plan_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_chat_message` (
  `message_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `request_id` VARCHAR(64) NOT NULL,
  `role` VARCHAR(12) NOT NULL,
  `content` TEXT NOT NULL,
  `status` VARCHAR(12) NOT NULL,
  `error_message` VARCHAR(255) DEFAULT NULL,
  `plan_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  UNIQUE KEY `uk_chat_request_role` (`conversation_id`, `request_id`, `role`),
  KEY `idx_chat_messages` (`conversation_id`, `message_id`),
  CONSTRAINT `fk_chat_message_session` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation` (`conversation_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_message_plan` FOREIGN KEY (`plan_id`) REFERENCES `ai_plan_record` (`ai_plan_id`) ON DELETE SET NULL,
  CONSTRAINT `ck_chat_role` CHECK (`role` IN ('user','assistant')),
  CONSTRAINT `ck_chat_status` CHECK (`status` IN ('PENDING','COMPLETED','FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
