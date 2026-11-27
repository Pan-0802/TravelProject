-- MySQL 8.0.16+ / upgrade an existing eight-table installation.
-- Select the existing application database first. Does not clear application data.
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
