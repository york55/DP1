package pe.pucp.tasfb2b.config;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;

public class LogBufferAppender extends AppenderBase<ILoggingEvent> {

    @Override
    protected void append(ILoggingEvent event) {
        if ("frontend-logger".equals(event.getLoggerName())) return;
        LogBuffer buf = LogBuffer.getInstance();
        if (buf == null) return;
        buf.addBackend(
            event.getLevel().toString(),
            event.getLoggerName(),
            event.getFormattedMessage()
        );
    }
}
