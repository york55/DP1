package pe.pucp.tasfb2b.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import pe.pucp.tasfb2b.dto.request.CreateSimulationRequest;
import pe.pucp.tasfb2b.dto.response.SimulationDto;
import pe.pucp.tasfb2b.service.KpiService;
import pe.pucp.tasfb2b.service.SimulationService;

import java.time.LocalDate;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@WebMvcTest(SimulationController.class)
@ActiveProfiles("test")
@WithMockUser
class SimulationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SimulationService simulationService;

    @MockBean
    private KpiService kpiService;

    @Test
    void testCreateSimulationReturns201() throws Exception {
        CreateSimulationRequest req = new CreateSimulationRequest();
        req.setScenarioType("PERIOD");
        req.setPeriodDays(3);
        req.setStartDate(LocalDate.of(2026, 5, 10));
        req.setAlgorithm("ALNS");
        req.setCancellationRate(10.0);
        req.setSeed(42L);
        req.setVolumePerDay(10);

        SimulationDto dto = new SimulationDto();
        dto.setId(1L);
        dto.setStatus("CONFIGURED");

        when(simulationService.createSimulation(any())).thenReturn(dto);

        mockMvc.perform(post("/api/simulations")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L));
    }

    @Test
    void testPauseReturns200WithStatusPaused() throws Exception {
        SimulationDto dto = new SimulationDto();
        dto.setId(1L);
        dto.setStatus("PAUSED");

        when(simulationService.pauseSimulation(1L)).thenReturn(dto);

        mockMvc.perform(put("/api/simulations/1/pause").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAUSED"));
    }

    @Test
    void testResumeReturns200WithStatusRunning() throws Exception {
        SimulationDto dto = new SimulationDto();
        dto.setId(1L);
        dto.setStatus("RUNNING");

        when(simulationService.resumeSimulation(1L)).thenReturn(dto);

        mockMvc.perform(put("/api/simulations/1/resume").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RUNNING"));
    }

    @Test
    void testGetKpisReturnsEmptyList() throws Exception {
        when(kpiService.findBySimulation(1L)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/simulations/1/kpis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
