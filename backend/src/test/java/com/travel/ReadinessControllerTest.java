package com.travel;

import com.travel.controller.ReadinessController;
import org.junit.jupiter.api.Test;
import javax.sql.DataSource;
import java.sql.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReadinessControllerTest {
    @Test void connectionFailureIsSanitized() throws Exception {
        DataSource source=mock(DataSource.class);
        when(source.getConnection()).thenThrow(new SQLException("secret JDBC URL and password"));
        var response=new ReadinessController(source).ready();
        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(response.getBody().code()).isEqualTo(50300);
        assertThat(response.getBody().toString()).doesNotContain("secret");
    }
    @Test void missingRequiredTableIsNotReadyAndConnectionIsClosed() throws Exception {
        DataSource source=mock(DataSource.class);
        Connection connection=mock(Connection.class);
        when(source.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenThrow(new SQLException("missing user table"));
        assertThat(new ReadinessController(source).ready().getStatusCode().value()).isEqualTo(503);
        verify(connection).close();
    }
}
