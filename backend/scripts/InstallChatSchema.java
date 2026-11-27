import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;

/** Java source launcher; credentials are inherited from the process, never printed or written to files. */
class InstallChatSchema {
    public static void main(String[] args) throws Exception {
        String script=Files.readString(Path.of(args[0]),StandardCharsets.UTF_8).replaceAll("(?m)^--.*$","");
        List<String> statements=Arrays.stream(script.split(";")).map(String::trim).filter(s->!s.isEmpty()).toList();
        if(statements.size()!=2 || !statements.get(0).startsWith("CREATE TABLE IF NOT EXISTS `ai_conversation`")
            || !statements.get(1).startsWith("CREATE TABLE IF NOT EXISTS `ai_chat_message`"))
            throw new IllegalArgumentException("Only the two additive chat-table statements are permitted.");
        try(Connection connection=DriverManager.getConnection(System.getenv("DB_URL"),System.getenv("DB_USERNAME"),System.getenv("DB_PASSWORD"))) {
            if(!connection.getMetaData().getDatabaseProductName().equals("MySQL")) throw new IllegalArgumentException("This migration is for MySQL only.");
            for(String ddl:statements) try(Statement statement=connection.createStatement()) {statement.execute(ddl);}
            System.out.println("Chat tables are ready; existing travel data were preserved.");
        }
    }
}
