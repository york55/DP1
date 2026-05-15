package pe.pucp.tasfb2b.domain.enums;

public enum SimulationStatus {
    CONFIGURED,
    BUFFERING,  // planning a time block
    PLAYING,    // replaying a planned block
    PAUSED,
    FINISHED
}
