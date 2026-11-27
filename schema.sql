-- TravelProject / MySQL 8.0.16+ / 完整10表与演示数据
-- 一次执行本文件即可重建课程演示库 travel_planner_course_demo。
-- 本文件会清空并重建这个专用演示库中的同名10张表。不要在此库保存需要保留的个人数据。
-- 原开发库 travel_planner_course 不受影响；旧库升级只运行04增量脚本。
CREATE DATABASE IF NOT EXISTS `travel_planner_course_demo` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `travel_planner_course_demo`;
SET NAMES utf8mb4;
-- 按外键依赖顺序移除子表，无需关闭外键检查。
DROP TABLE IF EXISTS ai_chat_message;
DROP TABLE IF EXISTS ai_conversation;
DROP TABLE IF EXISTS expense;
DROP TABLE IF EXISTS itinerary_item;
DROP TABLE IF EXISTS trip_day;
DROP TABLE IF EXISTS favorite;
DROP TABLE IF EXISTS ai_plan_record;
DROP TABLE IF EXISTS attraction;
DROP TABLE IF EXISTS trip;
DROP TABLE IF EXISTS `user`;

-- 个人旅行记录与智能规划系统 / MySQL 8.0.16+
-- 第一次在【空数据库】执行；非破坏性脚本，不包含 DROP TABLE。
-- 高德 POI 实时搜索结果不进入本库；attraction 只保存用户独立录入的景点。
-- 所有金额均为人民币元，演示数据中的费用仅用于课程测试。


-- 1. 用户
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

-- 2. 旅行计划：状态根据日期计算，不冗余存储
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

-- 3. 用户自行填写的景点（非高德POI数据镜像）
-- 课程演示约定：可登录查询本地用户贡献景点，仅创建者可编辑或删除。
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

-- 4. 收藏：用户和本地景点的关联表；联合唯一防重复收藏
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

-- 5. 每日行程：一趟旅行的某个日期至多一条记录
CREATE TABLE IF NOT EXISTS `trip_day` (
  `day_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `trip_date` DATE NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`day_id`),
  UNIQUE KEY `uk_trip_day` (`trip_id`, `trip_date`),
  CONSTRAINT `fk_trip_day_trip` FOREIGN KEY (`trip_id`) REFERENCES `trip` (`trip_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='旅行日期';

-- 6. 行程项：可关联本地景点，也可独立保存用户自写的活动名称
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

-- 7. 消费记录：只存用户真实记账；不将 AI 预估写入此表
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

-- 8. AI规划记录：草稿JSON与正式行程分离；旅行删除后保留历史并解除关联
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

-- Run once against the existing travel_planner_course database. Safe to re-run.
-- Additive migration only: no DROP, DELETE, or modification of the original eight tables.
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

-- 课程演示测试数据（全部为虚拟测试用户录入与模拟消费，非高德API结果）

-- 使用前请先执行 01_建库建表_MySQL8.sql。只适用于【新建空库】首次初始化。

-- 4 个测试账号的统一密码: Test@123456（BCrypt哈希；仅用于本地开发，严禁生产使用）



SET NAMES utf8mb4;

START TRANSACTION;

-- user: 共 4 条演示记录（除用户独立录入外，所有费用均为模拟值）
INSERT INTO `user` (`user_id`, `username`, `password_hash`, `nickname`) VALUES
  (1, 'demo_zhang', '$2y$10$P5csAO8JMIpLPGtqzafoDeLtyl/MG6/9OuAkXguwjuuwyO27bZUGW', '张同学'),
  (2, 'demo_li', '$2y$10$Zf9MiRrR0IJ6Nt3KpDg.WOugGxgp9mxV8LR6LVxrlykZfRwlf8kRS', '李同学'),
  (3, 'demo_wang', '$2y$10$Ac/0w/4yZiJ4Zx8pOH7Cl.p2q2Tn.wxatP5aI0os2UBKOjipYKuWO', '王同学'),
  (4, 'demo_chen', '$2y$10$fGdbJ/GNoiCarXhm9kQLYunF78Z.AcDWZMDFlVp7CXjheuIET1awm', '陈同学');


-- trip: 共 8 条演示记录（除用户独立录入外，所有费用均为模拟值）
INSERT INTO `trip` (`trip_id`, `user_id`, `title`, `destination`, `start_date`, `end_date`, `total_budget`) VALUES
  (1, 1, '重庆三日游', '重庆', '2026-11-19', '2026-11-21', 1500.0),
  (2, 1, '成都周末游', '成都', '2026-10-10', '2026-10-11', 900.0),
  (3, 2, '西安文化游', '西安', '2026-12-02', '2026-12-05', 2200.0),
  (4, 2, '北京五日游', '北京', '2026-08-10', '2026-08-14', 4000.0),
  (5, 3, '重庆美食之旅', '重庆', '2026-11-15', '2026-11-17', 1000.0),
  (6, 3, '杭州初秋游', '杭州', '2026-10-03', '2026-10-05', 1800.0),
  (7, 4, '长沙两日游', '长沙', '2027-01-09', '2027-01-10', 850.0),
  (8, 4, '南京三日游', '南京', '2026-09-04', '2026-09-06', 1300.0);


-- attraction: 共 12 条演示记录（除用户独立录入外，所有费用均为模拟值）
INSERT INTO `attraction` (`attraction_id`, `created_by`, `name`, `city`, `category`, `description`, `suggested_duration_minutes`, `reference_ticket_price`) VALUES
  (1, 1, '解放碑', '重庆', '城市地标', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 90, NULL),
  (2, 1, '洪崖洞', '重庆', '城市观光', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 120, NULL),
  (3, 3, '磁器口古镇', '重庆', '历史街区', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 100, NULL),
  (4, 2, '宽窄巷子', '成都', '历史街区', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 90, NULL),
  (5, 2, '武侯祠', '成都', '历史文化', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 100, NULL),
  (6, 2, '西安钟楼', '西安', '城市地标', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 60, NULL),
  (7, 3, '大雁塔', '西安', '历史文化', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 90, NULL),
  (8, 4, '故宫博物院', '北京', '历史文化', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 180, NULL),
  (9, 4, '天坛公园', '北京', '园林公园', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 120, NULL),
  (10, 2, '西湖', '杭州', '自然风光', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 150, NULL),
  (11, 3, '橘子洲', '长沙', '自然风光', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 120, NULL),
  (12, 4, '夫子庙', '南京', '历史街区', '课程演示：虚拟用户自行录入的景点资料；非高德接口复制内容。', 90, NULL);


-- favorite: 共 13 条演示记录（除用户独立录入外，所有费用均为模拟值）
INSERT INTO `favorite` (`favorite_id`, `user_id`, `attraction_id`) VALUES
  (1, 1, 1),
  (2, 1, 2),
  (3, 1, 4),
  (4, 1, 5),
  (5, 2, 6),
  (6, 2, 7),
  (7, 2, 8),
  (8, 3, 1),
  (9, 3, 3),
  (10, 3, 10),
  (11, 4, 9),
  (12, 4, 11),
  (13, 4, 12);


-- trip_day: 共 25 条演示记录（除用户独立录入外，所有费用均为模拟值）
INSERT INTO `trip_day` (`day_id`, `trip_id`, `trip_date`, `description`) VALUES
  (1, 1, '2026-11-19', '重庆行程第1天'),
  (2, 1, '2026-11-20', '重庆行程第2天'),
  (3, 1, '2026-11-21', '重庆行程第3天'),
  (4, 2, '2026-10-10', '成都行程第1天'),
  (5, 2, '2026-10-11', '成都行程第2天'),
  (6, 3, '2026-12-02', '西安行程第1天'),
  (7, 3, '2026-12-03', '西安行程第2天'),
  (8, 3, '2026-12-04', '西安行程第3天'),
  (9, 3, '2026-12-05', '西安行程第4天'),
  (10, 4, '2026-08-10', '北京行程第1天'),
  (11, 4, '2026-08-11', '北京行程第2天'),
  (12, 4, '2026-08-12', '北京行程第3天'),
  (13, 4, '2026-08-13', '北京行程第4天'),
  (14, 4, '2026-08-14', '北京行程第5天'),
  (15, 5, '2026-11-15', '重庆行程第1天');
INSERT INTO `trip_day` (`day_id`, `trip_id`, `trip_date`, `description`) VALUES
  (16, 5, '2026-11-16', '重庆行程第2天'),
  (17, 5, '2026-11-17', '重庆行程第3天'),
  (18, 6, '2026-10-03', '杭州行程第1天'),
  (19, 6, '2026-10-04', '杭州行程第2天'),
  (20, 6, '2026-10-05', '杭州行程第3天'),
  (21, 7, '2027-01-09', '长沙行程第1天'),
  (22, 7, '2027-01-10', '长沙行程第2天'),
  (23, 8, '2026-09-04', '南京行程第1天'),
  (24, 8, '2026-09-05', '南京行程第2天'),
  (25, 8, '2026-09-06', '南京行程第3天');


-- itinerary_item: 共 39 条演示记录（除用户独立录入外，所有费用均为模拟值）
INSERT INTO `itinerary_item` (`item_id`, `day_id`, `attraction_id`, `item_name`, `start_time`, `end_time`, `sort_order`, `transportation`, `estimated_cost`, `source_type`, `note`) VALUES
  (1, 1, 1, '解放碑', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'AI', '示例行程（非官方票价）'),
  (2, 1, NULL, '重庆当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'AI', '用户手动确认的活动名称；预算为示例估算'),
  (3, 2, 2, '洪崖洞', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'AI', '示例行程（非官方票价）'),
  (4, 2, NULL, '重庆当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'AI', '用户手动确认的活动名称；预算为示例估算'),
  (5, 3, 3, '磁器口古镇', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'AI', '示例行程（非官方票价）'),
  (6, 4, 4, '宽窄巷子', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (7, 4, NULL, '成都当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (8, 5, 5, '武侯祠', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (9, 6, 6, '西安钟楼', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (10, 6, NULL, '西安当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (11, 7, 7, '大雁塔', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (12, 7, NULL, '西安当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (13, 8, 6, '西安钟楼', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (14, 9, 7, '大雁塔', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (15, 10, 8, '故宫博物院', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）');
INSERT INTO `itinerary_item` (`item_id`, `day_id`, `attraction_id`, `item_name`, `start_time`, `end_time`, `sort_order`, `transportation`, `estimated_cost`, `source_type`, `note`) VALUES
  (16, 10, NULL, '北京当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (17, 11, 9, '天坛公园', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (18, 11, NULL, '北京当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (19, 12, 8, '故宫博物院', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (20, 13, 9, '天坛公园', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (21, 14, 8, '故宫博物院', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (22, 15, 1, '解放碑', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (23, 15, NULL, '重庆当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (24, 16, 2, '洪崖洞', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (25, 16, NULL, '重庆当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (26, 17, 3, '磁器口古镇', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (27, 18, 10, '西湖', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (28, 18, NULL, '杭州当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (29, 19, 10, '西湖', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (30, 19, NULL, '杭州当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算');
INSERT INTO `itinerary_item` (`item_id`, `day_id`, `attraction_id`, `item_name`, `start_time`, `end_time`, `sort_order`, `transportation`, `estimated_cost`, `source_type`, `note`) VALUES
  (31, 20, 10, '西湖', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (32, 21, 11, '橘子洲', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (33, 21, NULL, '长沙当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (34, 22, 11, '橘子洲', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (35, 23, 12, '夫子庙', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (36, 23, NULL, '南京当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (37, 24, 12, '夫子庙', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）'),
  (38, 24, NULL, '南京当地美食体验', '12:00:00', '13:00:00', 2, '步行', 60.0, 'MANUAL', '用户手动确认的活动名称；预算为示例估算'),
  (39, 25, 12, '夫子庙', '09:00:00', '11:00:00', 1, '公共交通', 0.0, 'MANUAL', '示例行程（非官方票价）');


-- expense: 共 27 条演示记录（除用户独立录入外，所有费用均为模拟值）
INSERT INTO `expense` (`expense_id`, `trip_id`, `category`, `amount`, `spent_on`, `description`) VALUES
  (1, 2, 'TRANSPORT', 35, '2026-10-10', '市内交通（模拟数据）'),
  (2, 2, 'FOOD', 85, '2026-10-10', '用餐（模拟数据）'),
  (3, 2, 'HOTEL', 280, '2026-10-11', '住宿（模拟数据）'),
  (4, 2, 'TICKET', 60, '2026-10-11', '参观门票（模拟数据）'),
  (5, 2, 'FOOD', 46, '2026-10-11', '小吃（模拟数据）'),
  (6, 2, 'OTHER', 20, '2026-10-11', '其他开销（模拟数据）'),
  (7, 4, 'TRANSPORT', 35, '2026-08-10', '市内交通（模拟数据）'),
  (8, 4, 'FOOD', 85, '2026-08-10', '用餐（模拟数据）'),
  (9, 4, 'HOTEL', 280, '2026-08-11', '住宿（模拟数据）'),
  (10, 4, 'TICKET', 60, '2026-08-11', '参观门票（模拟数据）'),
  (11, 4, 'FOOD', 46, '2026-08-12', '小吃（模拟数据）'),
  (12, 4, 'OTHER', 20, '2026-08-12', '其他开销（模拟数据）'),
  (13, 5, 'TRANSPORT', 35, '2026-11-15', '市内交通（模拟数据）'),
  (14, 5, 'FOOD', 85, '2026-11-15', '用餐（模拟数据）'),
  (15, 5, 'HOTEL', 280, '2026-11-16', '住宿（模拟数据）');
INSERT INTO `expense` (`expense_id`, `trip_id`, `category`, `amount`, `spent_on`, `description`) VALUES
  (16, 6, 'TRANSPORT', 35, '2026-10-03', '市内交通（模拟数据）'),
  (17, 6, 'FOOD', 85, '2026-10-03', '用餐（模拟数据）'),
  (18, 6, 'HOTEL', 280, '2026-10-04', '住宿（模拟数据）'),
  (19, 6, 'TICKET', 60, '2026-10-04', '参观门票（模拟数据）'),
  (20, 6, 'FOOD', 46, '2026-10-05', '小吃（模拟数据）'),
  (21, 6, 'OTHER', 20, '2026-10-05', '其他开销（模拟数据）'),
  (22, 8, 'TRANSPORT', 35, '2026-09-04', '市内交通（模拟数据）'),
  (23, 8, 'FOOD', 85, '2026-09-04', '用餐（模拟数据）'),
  (24, 8, 'HOTEL', 280, '2026-09-05', '住宿（模拟数据）'),
  (25, 8, 'TICKET', 60, '2026-09-05', '参观门票（模拟数据）'),
  (26, 8, 'FOOD', 46, '2026-09-06', '小吃（模拟数据）'),
  (27, 8, 'OTHER', 20, '2026-09-06', '其他开销（模拟数据）');


-- 当前版本完整AI结构：含成功保存、可保存草稿与失败分支。
INSERT INTO `ai_plan_record` (`ai_plan_id`,`user_id`,`trip_id`,`request_json`,`response_json`,`estimated_total`,`status`,`error_message`,`saved_at`) VALUES
(1,1,1,CAST('{"tripId":1,"destination":"重庆","startDate":"2026-11-19","endDate":"2026-11-21","travelDays":3,"totalBudget":1500,"transportation":"公共交通","preferences":["文化","慢节奏"],"requirements":"每天安排适量活动，保留用餐和休息时间"}' AS JSON),CAST('{"estimatedTotal":60,"days":[{"date":"2026-11-19","dayNumber":1,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"解放碑","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2026-11-20","dayNumber":2,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"洪崖洞","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2026-11-21","dayNumber":3,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"磁器口古镇","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]}]}' AS JSON),60,'SAVED',NULL,CURRENT_TIMESTAMP),
(2,2,3,CAST('{"tripId":3,"destination":"西安","startDate":"2026-12-02","endDate":"2026-12-05","travelDays":4,"totalBudget":2200,"transportation":"公共交通","preferences":["文化","慢节奏"],"requirements":"每天安排适量活动，保留用餐和休息时间"}' AS JSON),CAST('{"estimatedTotal":80,"days":[{"date":"2026-12-02","dayNumber":1,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"西安钟楼","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2026-12-03","dayNumber":2,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"陕西历史博物馆","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2026-12-04","dayNumber":3,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"大雁塔","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2026-12-05","dayNumber":4,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"西安城墙","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]}]}' AS JSON),80,'DRAFT',NULL,NULL),
(3,3,NULL,CAST('{"tripId":null,"destination":"重庆","startDate":"2026-12-01","endDate":"2026-12-03","travelDays":3,"totalBudget":1000,"transportation":"公共交通","preferences":["文化","慢节奏"],"requirements":"每天安排适量活动，保留用餐和休息时间"}' AS JSON),NULL,NULL,'FAILED','测试示例：模型服务暂时不可用',NULL),
(4,4,7,CAST('{"tripId":7,"destination":"长沙","startDate":"2027-01-09","endDate":"2027-01-10","travelDays":2,"totalBudget":850,"transportation":"公共交通","preferences":["文化","慢节奏"],"requirements":"每天安排适量活动，保留用餐和休息时间"}' AS JSON),CAST('{"estimatedTotal":40,"days":[{"date":"2027-01-09","dayNumber":1,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"橘子洲","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2027-01-10","dayNumber":2,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"岳麓山","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]}]}' AS JSON),40,'DRAFT',NULL,NULL),
(5,1,NULL,CAST('{"tripId":null,"destination":"重庆","startDate":"2026-12-01","endDate":"2026-12-03","travelDays":3,"totalBudget":1500,"transportation":"公共交通","preferences":["文化","慢节奏"],"requirements":"每天安排适量活动，保留用餐和休息时间"}' AS JSON),CAST('{"estimatedTotal":60,"days":[{"date":"2026-12-01","dayNumber":1,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"解放碑","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2026-12-02","dayNumber":2,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"洪崖洞","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2026-12-03","dayNumber":3,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"磁器口古镇","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]}]}' AS JSON),60,'DRAFT',NULL,NULL);

COMMIT;

-- 多轮会话测试数据：需先完成01、02和04建表，仅在空会话表首次导入。
INSERT INTO ai_conversation(conversation_id,user_id,title,conditions_json,current_plan_id,current_days_json,memory,version) VALUES
(1,1,'重庆 · 3天旅行',CAST('{"tripId":null,"destination":"重庆","startDate":"2026-12-01","endDate":"2026-12-03","travelDays":3,"totalBudget":1500,"transportation":"公共交通","preferences":["文化","慢节奏"],"requirements":"每天安排适量活动，保留用餐和休息时间"}' AS JSON),5,CAST('[{"date":"2026-12-01","dayNumber":1,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"解放碑","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2026-12-02","dayNumber":2,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"洪崖洞","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]},{"date":"2026-12-03","dayNumber":3,"description":"按日期安排，确认后才写入正式行程","items":[{"itemName":"磁器口古镇","startTime":"09:00","endTime":"11:00","sortOrder":1,"attractionId":null,"transportation":"步行","estimatedCost":20,"note":"课程测试资料，费用为模拟值；出行前请核实开放信息。"}]}]' AS JSON),'慢节奏，每天适量活动',2),
(2,1,'失败重试示例',CAST('{"tripId":null,"destination":"重庆","startDate":"2026-12-01","endDate":"2026-12-03","travelDays":3,"totalBudget":1500,"transportation":"公共交通","preferences":["文化","慢节奏"],"requirements":"每天安排适量活动，保留用餐和休息时间"}' AS JSON),NULL,NULL,'',2);
INSERT INTO ai_chat_message(conversation_id,request_id,role,content,status,error_message,plan_id) VALUES
(1,'seed-initial-001','user','请安排重庆三日游，每天少量景点。','COMPLETED',NULL,NULL),
(1,'seed-initial-001','assistant','已按日期安排三天行程。你可以继续提问，确认后保存到旅行。','COMPLETED',NULL,5),
(2,'seed-failure-001','user','请帮我生成旅行计划','FAILED','演示失败状态：模型临时不可用，请使用重试按钮。',NULL);


-- 超过20条的分页样本、零预算、跨日进行中、无行程等分支。
INSERT INTO trip(user_id,title,destination,start_date,end_date,total_budget) VALUES
(1,'分页演示01','北京','2026-12-01','2026-12-01',300),
(1,'分页演示02','北京','2026-12-01','2026-12-01',300),
(1,'分页演示03','北京','2026-12-01','2026-12-01',300),
(1,'分页演示04','北京','2026-12-01','2026-12-01',300),
(1,'分页演示05','北京','2026-12-01','2026-12-01',300),
(1,'分页演示06','北京','2026-12-01','2026-12-01',300),
(1,'分页演示07','北京','2026-12-01','2026-12-01',300),
(1,'分页演示08','北京','2026-12-01','2026-12-01',300),
(1,'分页演示09','北京','2026-12-01','2026-12-01',300),
(1,'分页演示10','北京','2026-12-01','2026-12-01',300),
(1,'分页演示11','北京','2026-12-01','2026-12-01',300),
(1,'分页演示12','北京','2026-12-01','2026-12-01',300),
(1,'分页演示13','北京','2026-12-01','2026-12-01',300),
(1,'分页演示14','北京','2026-12-01','2026-12-01',300),
(1,'分页演示15','北京','2026-12-01','2026-12-01',300),
(1,'分页演示16','北京','2026-12-01','2026-12-01',300),
(1,'分页演示17','北京','2026-12-01','2026-12-01',300),
(1,'分页演示18','北京','2026-12-01','2026-12-01',300),
(1,'分页演示19','北京','2026-12-01','2026-12-01',300),
(1,'分页演示20','北京','2026-12-01','2026-12-01',300),
(1,'分页演示21','北京','2026-12-01','2026-12-01',300);
INSERT INTO trip(user_id,title,destination,start_date,end_date,total_budget) VALUES (1,'进行中与零预算示例','重庆',DATE_SUB(CURDATE(),INTERVAL 1 DAY),DATE_ADD(CURDATE(),INTERVAL 1 DAY),0);

-- 验证：10张表、所有费用类别、三种AI状态、多轮成功/失败消息均可查看。
SELECT table_name,table_collation FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name;
SELECT '演示登录：demo_zhang / Test@123456' AS login_note;
