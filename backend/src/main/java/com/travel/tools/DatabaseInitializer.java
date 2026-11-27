package com.travel.tools;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.sql.DriverManager;

/** Standalone entry point. Credentials come from the environment and are never printed. */
public final class DatabaseInitializer {
    private DatabaseInitializer() {}
    public static void main(String[] args) throws Exception {
        String url=System.getenv("DB_URL");
        if(url==null||!url.matches("jdbc:mysql://[^/]+/[^?]*(\\?.*)?"))
            throw new IllegalArgumentException("请配置有效的 DB_URL、DB_USERNAME、DB_PASSWORD 环境变量");
        String server=url.replaceFirst("/[^/?]*(\\?.*)?$","/$1");
        boolean rebuild=args.length>1&&args[1].equals("--rebuild-demo");
        Path schema=Path.of(args.length==0?"../schema.sql":args[0]).toAbsolutePath().normalize();
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
            ScriptUtils.executeSqlScript(connection,new EncodedResource(new FileSystemResource(schema),StandardCharsets.UTF_8));
            connection.setCatalog("travel_planner_course_demo");
            try(var statement=connection.prepareStatement("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=?")) {
                statement.setString(1,"travel_planner_course_demo");
                try(var result=statement.executeQuery()){result.next();if(result.getInt(1)!=10)throw new IllegalStateException("完整初始化必须包含10张表");}
            }
            System.out.println("完整演示库初始化成功：10张表。登录 demo_zhang / Test@123456");
            System.out.println("启动后端时将 DB_URL 中的数据库名设置为 travel_planner_course_demo。");
        }
    }
}
