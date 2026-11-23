package com.travel;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.core.io.ByteArrayResource;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** Opt-in: inherits the HTTP regression suite and runs it against an isolated real MySQL schema. */
@EnabledIfEnvironmentVariable(named="RUN_MYSQL_ACCEPTANCE", matches="true")
@ActiveProfiles(value="mysql-acceptance", inheritProfiles=false)
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class MysqlAcceptanceTest extends BackendIntegrationTest {
    private static String schema;
    private static String serverUrl;
    private static String databaseUrl;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) throws Exception {
        serverUrl=System.getenv("MYSQL_SERVER_URL");
        // Server URL must have an empty database path; never repurpose the existing application schema.
        if(serverUrl==null || !serverUrl.matches("jdbc:mysql://[^/]+/(\\?.*)?"))
            throw new IllegalArgumentException("MYSQL_SERVER_URL 必须是未指定数据库的 MySQL JDBC 地址");
        schema="travel_acceptance_"+UUID.randomUUID().toString().replace("-", "");
        try(var connection=admin();var statement=connection.createStatement()) {
            statement.execute("CREATE DATABASE `"+schema+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
        }
        databaseUrl=serverUrl.replaceFirst("/(\\?|$)","/"+schema+"$1");
        try(var connection=DriverManager.getConnection(databaseUrl,username(),password())) {
            String ddl=Files.readString(Path.of("../ER图和Mysql/01_建库建表_MySQL8.sql"),StandardCharsets.UTF_8)
                .replaceFirst("(?is)CREATE DATABASE IF NOT EXISTS.*?;", "")
                .replaceAll("(?im)^USE\\s+.*?;", "")
                .replaceAll("(?im)^SET NAMES\\s+.*?;", "");
            ScriptUtils.executeSqlScript(connection,new ByteArrayResource(ddl.getBytes(StandardCharsets.UTF_8)));
        } catch(Exception e) { cleanup(); throw e; }
        registry.add("spring.datasource.url", () -> databaseUrl);
        registry.add("spring.datasource.username", MysqlAcceptanceTest::username);
        registry.add("spring.datasource.password", MysqlAcceptanceTest::password);
    }
    private static String username() { return System.getenv("MYSQL_TEST_USERNAME"); }
    private static String password() { return System.getenv("MYSQL_TEST_PASSWORD"); }
    private static Connection admin() throws SQLException { return DriverManager.getConnection(serverUrl,username(),password()); }
    @AfterAll static void cleanup() throws Exception {
        if(schema!=null && schema.matches("travel_acceptance_[0-9a-f]{32}")) {
            try(var connection=admin();var statement=connection.createStatement()) {
                statement.execute("DROP DATABASE `"+schema+"`");
            }
            schema=null;
        }
    }

    @Test
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void concurrentAiSaveCommitsOnlyOneImport() throws Exception {
        ExecutorService workers=Executors.newFixedThreadPool(2);
        try {
            String id=draft();
            String body=json.writeValueAsString(new com.travel.dto.AiRequests.Save(Long.valueOf(tripId),false,plannedDays()));
            CountDownLatch start=new CountDownLatch(1);
            Callable<Integer> save=() -> {
                if(!start.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("concurrency test did not start");
                return mvc.perform(post("/api/ai/plans/"+id+"/save").header("Authorization","Bearer "+token)
                    .contentType("application/json").content(body)).andReturn().getResponse().getStatus();
            };
            Future<Integer> first=workers.submit(save),second=workers.submit(save); start.countDown();
            assertThat(List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM itinerary_item",Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT status FROM ai_plan_record",String.class)).isEqualTo("SAVED");
        } finally {
            workers.shutdownNow();
            jdbc.update("DELETE FROM `user` WHERE username IN ('owner','other')");
        }
    }
}
