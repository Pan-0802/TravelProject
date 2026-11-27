package com.travel.tools;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.Arrays;
import java.util.List;

/** Standalone entry point. Credentials come from the environment and are never printed. */
public final class DatabaseInitializer {
    private DatabaseInitializer() {}
    public static void main(String[] args) throws Exception {
        String url=System.getenv("DB_URL");
        if(url==null||!url.matches("jdbc:mysql://[^/]+/[^?]*(\\?.*)?"))
            throw new IllegalArgumentException("请配置有效的 DB_URL、DB_USERNAME、DB_PASSWORD 环境变量");
        String server=url.replaceFirst("/[^/?]*(\\?.*)?$","/$1");
        if(!url.replaceFirst("^jdbc:mysql://[^/]+/([^?]*).*", "$1").equals("travel_planner_course_demo"))
            throw new IllegalArgumentException("自动初始化仅用于 travel_planner_course_demo；自定义库请选中空库后执行 db/mysql/schema.sql。");
        boolean rebuild=Arrays.asList(args).contains("--rebuild-demo");
        String schemaFile=Arrays.stream(args).filter(arg->!arg.startsWith("--")).findFirst().orElse(null);
        Resource schema=schemaFile==null?new ClassPathResource("db/mysql/schema.sql"):
            new FileSystemResource(Path.of(schemaFile).toAbsolutePath().normalize());
        if(!schema.exists())throw new IllegalArgumentException("找不到初始化脚本，请重新构建后端。");
        try(var connection=DriverManager.getConnection(server,System.getenv("DB_USERNAME"),System.getenv("DB_PASSWORD"))) {
            boolean exists=false;
            try(var databases=connection.getMetaData().getCatalogs()) {
                while(databases.next())if("travel_planner_course_demo".equals(databases.getString(1)))exists=true;
            }
            if(exists&&!rebuild)throw new IllegalStateException("专用演示库已存在。保留数据请直接启动；确需重建时使用 -RebuildDemo 参数。");
            if(!exists) {
                // Atomic ownership: if another process creates this catalog meanwhile, CREATE
                // fails before the script can run any DROP statements against that catalog.
                try(var statement=connection.createStatement()) {
                    statement.execute("CREATE DATABASE `travel_planner_course_demo` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
                }
            }
            connection.setCatalog("travel_planner_course_demo");
            if(exists&&rebuild) {
                try(var statement=connection.createStatement()) {
                    for(String drop:List.of(
                        "DROP TABLE IF EXISTS ai_chat_message", "DROP TABLE IF EXISTS ai_conversation",
                        "DROP TABLE IF EXISTS expense", "DROP TABLE IF EXISTS itinerary_item",
                        "DROP TABLE IF EXISTS trip_day", "DROP TABLE IF EXISTS favorite",
                        "DROP TABLE IF EXISTS ai_plan_record", "DROP TABLE IF EXISTS attraction",
                        "DROP TABLE IF EXISTS trip", "DROP TABLE IF EXISTS `user`"))statement.execute(drop);
                }
            }
            ScriptUtils.executeSqlScript(connection,new EncodedResource(schema,StandardCharsets.UTF_8));
            try(var statement=connection.prepareStatement("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=?")) {
                statement.setString(1,"travel_planner_course_demo");
                try(var result=statement.executeQuery()){result.next();if(result.getInt(1)!=10)throw new IllegalStateException("完整初始化必须包含10张表");}
            }
            System.out.println("初始化成功：10张空表。请在前端注册自己的账号。");
            System.out.println("启动后端时将 DB_URL 中的数据库名设置为 travel_planner_course_demo。");
        }
    }
}
