-- 测试和验收 SQL：在 01、02 成功执行后运行。本文件不会破坏初始数据。
USE `travel_planner_course`;

-- Q1：八张表的记录数，结果应分别为 4、8、12、13、25、39、27、5（ai_plan_record 含一条未关联行程的草稿）。
SELECT 'user' AS table_name, COUNT(*) AS row_count FROM `user`
UNION ALL SELECT 'trip', COUNT(*) FROM `trip`
UNION ALL SELECT 'attraction', COUNT(*) FROM `attraction`
UNION ALL SELECT 'favorite', COUNT(*) FROM `favorite`
UNION ALL SELECT 'trip_day', COUNT(*) FROM `trip_day`
UNION ALL SELECT 'itinerary_item', COUNT(*) FROM `itinerary_item`
UNION ALL SELECT 'expense', COUNT(*) FROM `expense`
UNION ALL SELECT 'ai_plan_record', COUNT(*) FROM `ai_plan_record`;

-- Q2：查询用户1的全部旅行，以及实时计算的旅行状态
SELECT t.trip_id, t.title, t.destination, t.start_date, t.end_date,
       CASE WHEN CURDATE() < t.start_date THEN '未开始'
            WHEN CURDATE() > t.end_date THEN '已结束'
            ELSE '进行中' END AS calculated_status
FROM `trip` t WHERE t.user_id = 1 ORDER BY t.start_date DESC;

-- Q3：查询旅行1的按日行程及景点（多表关联）
SELECT t.title, d.trip_date, i.sort_order, i.item_name,
       a.name AS local_attraction, i.start_time, i.end_time, i.source_type
FROM `trip` t
JOIN `trip_day` d ON d.trip_id=t.trip_id
LEFT JOIN `itinerary_item` i ON i.day_id=d.day_id
LEFT JOIN `attraction` a ON a.attraction_id=i.attraction_id
WHERE t.trip_id=1 AND t.user_id=1
ORDER BY d.trip_date, i.sort_order, i.item_id;

-- Q4：用户1的收藏清单（联合查询）
SELECT f.favorite_id, a.name, a.city, a.category, u.username AS author
FROM `favorite` f
JOIN `attraction` a ON a.attraction_id=f.attraction_id
JOIN `user` u ON u.user_id=a.created_by
WHERE f.user_id=1 ORDER BY f.favorite_id;

-- Q5：旅行5的消费分类统计（GROUP BY）
SELECT category, COUNT(*) AS records, SUM(amount) AS total_spent
FROM `expense` WHERE trip_id=5
GROUP BY category ORDER BY total_spent DESC;

-- Q6：用户2各旅行预算/实际消费/剩余预算（LEFT JOIN + SUM）
SELECT t.trip_id, t.title, t.total_budget,
       COALESCE(SUM(e.amount),0) AS actual_spent,
       t.total_budget-COALESCE(SUM(e.amount),0) AS balance
FROM `trip` t LEFT JOIN `expense` e ON e.trip_id=t.trip_id
WHERE t.user_id=2
GROUP BY t.trip_id,t.title,t.total_budget ORDER BY t.trip_id;

-- Q7：所有用户旅行次数和旅行天数统计（聚合）
SELECT u.user_id, u.username, COUNT(t.trip_id) AS trip_count,
       COALESCE(SUM(DATEDIFF(t.end_date,t.start_date)+1),0) AS total_days
FROM `user` u LEFT JOIN `trip` t ON t.user_id=u.user_id
GROUP BY u.user_id,u.username ORDER BY u.user_id;

-- Q8：AI 规划状态与结构化JSON读取；注意不是实际消费
SELECT ai_plan_id, user_id, trip_id, status, estimated_total,
       JSON_UNQUOTE(JSON_EXTRACT(request_json,'$.destination')) AS destination
FROM `ai_plan_record` ORDER BY ai_plan_id;

-- Q9：查看外键/唯一约束/检查约束定义
SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema='travel_planner_course'
ORDER BY table_name, constraint_type, constraint_name;

-- Q10：演示事务回滚（执行前后旅行2消费记录数不变）
SELECT COUNT(*) AS before_test FROM `expense` WHERE trip_id=2;
START TRANSACTION;
INSERT INTO `expense` (`trip_id`,`category`,`amount`,`spent_on`,`description`)
VALUES (2,'FOOD',99.99,'2026-10-10','回滚测试临时记录');
SELECT COUNT(*) AS within_transaction FROM `expense` WHERE trip_id=2;
ROLLBACK;
SELECT COUNT(*) AS after_rollback FROM `expense` WHERE trip_id=2;

-- 以下三条仅用于在测试环境【单独执行】观察错误，不属于批量验收脚本：
-- 违反唯一约束：INSERT INTO `favorite` (`user_id`,`attraction_id`) VALUES (1,1);
-- 违反外键约束：INSERT INTO `favorite` (`user_id`,`attraction_id`) VALUES (1,999999);
-- 违反 CHECK：INSERT INTO `expense` (`trip_id`,`category`,`amount`,`spent_on`) VALUES (2,'FOOD',-3.00,'2026-10-10');
