# TASF.B2B Client Use Cases

The TASF.B2B system is a Logistics and Baggage Transfer Simulation Platform designed to run scenarios, configure the ALNS optimization algorithm, handle disruptions, and analyze routing efficiency.

Here is the complete list of client-facing use cases:

## 1. Data Setup & Configuration
*   **Upload Simulation Data:** The client can upload CSV files containing airport data, flight schedules, and baggage batches.
*   **Configure Scenario Parameters:** The client can configure the ALNS optimization algorithm, define the strict simulation time window of 5 days, and set the random cancellation rate to stress-test the system.

## 2. Simulation Execution
*   **Run Simulation:** The client can start the simulation engine, watching the simulated clock advance automatically over the 5-day period.
*   **Pause/Resume Simulation:** The client can pause the simulation at any point to inspect a specific state of the network, and resume it when ready.
*   **Stop Simulation:** The client can abort the simulation early if needed.

## 3. Real-Time Monitoring & Visualization
*   **Global Map Tracking:** The client can view a live map (frontend) showing active flights moving between airports.
*   **Warehouse Occupancy Monitoring:** The client can track real-time baggage storage levels at each airport, using color-coded semaphore alerts (Low, Moderate, High, Critical) to spot bottlenecks.
*   **Flight Capacity Tracking:** The client can monitor how full flights are in real-time.

## 4. Disruption Management
*   **Simulate Flight Cancellations:** The client can inject chaos by manually cancelling a flight mid-simulation.
*   **Observe Dynamic Replanning:** Following a cancellation, the client observes the system automatically re-routing the affected baggage to new flights without manual intervention.

## 5. Analytics & Reporting
*   **Track Real-time KPIs:** The client can monitor live performance metrics, such as On-Time Delivery Percentage, Number of Delayed Bags, and Average Flight Occupancy.
*   **Analyze Algorithm Performance:** The client can review the final KPIs to determine the operational cost and efficiency of the ALNS algorithm on their datasets over the 5 days.
