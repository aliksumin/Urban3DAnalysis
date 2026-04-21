# Pedestrian Wind Comfort Metrics Implementation Plan

This plan outlines the steps to integrate industry-standard Pedestrian Wind Comfort Criteria (Lawson, Davenport, NEN 8100, and Beaufort Scale) into the UrbanAnalysis wind simulation engine.

## User Review Required

> [!IMPORTANT]
> The requested criteria (Lawson, Davenport, and NEN 8100) are typically based on **exceedance probabilities** (e.g., wind exceeding 5 m/s for >5% of the time over a year). Since our ONNX GAN computes an *instantaneous, stationary* wind flow for a given slider speed, we will implement these as **Spatial Proxies**. We map the instantaneous local wind speeds directly to the threshold classes for visualization, representing how the area would perform under the defined wind conditions. Does this proxy approach sound good to you?

## Proposed Changes

---

### Backend (Python API)

We will modify the FastAPI backend to compute discrete color mappings based on the chosen comfort metric when generating the PNG overlay.

#### [MODIFY] [api.py](file:///d:/New/Apps/UrbanAnalysis/backend/api.py)
- **API Model:** Update `PredictRequest` to accept a new string field `comfort_metric` defaulting to `"speed"`.
- **Image Encoding:** In `predict()` (specifically the `_encode_image` thread), check `body.comfort_metric`.
- **Logic Matrix:**
  - Calculate `actual_speeds = wind_speeds_arr * (body.wind_speed / 15.0)`
  - **`speed`**: Retain current continuous Turbo colormap mapping with perceptual Gamma stretch.
  - **`lawson`**: Apply discrete bins `[4.0, 6.0, 8.0, 10.0]` mapped to [`Blue`, `Cyan`, `Green`, `Yellow`, `Red`].
  - **`davenport`**: Apply discrete bins `[3.6, 5.3, 7.6, 9.8]` mapped to [`Blue`, `Cyan`, `Green`, `Yellow`, `Red`].
  - **`nen8100`**: Apply discrete bins `[5.0, 15.0]` mapped to [`Green` (Class A/B/C proxy), `Orange` (Class D/E proxy), `Red` (Danger)].
  - **`beaufort`**: Apply 8 discrete bins for Beaufort categories mapped to an increasing intensity color scale.
- **Masking:** Ensure buildings (where `wind_speeds_arr == 0`) remain a distinct dark tone (e.g., dark purple, matching the 0.1 Turbo floor) across all discrete mappings so architecture is clearly visible.

---

### Frontend (React App)

We will introduce state controls for the new metric and an adaptive visual legend to map the colors strictly for the user.

#### [MODIFY] [Environment3D.jsx](file:///d:/New/Apps/UrbanAnalysis/frontend/src/components/Environment3D.jsx)
- **State Store:** Add `windComfortMetric: 'speed'` and `setWindComfortMetric` into the `useStore`.

#### [MODIFY] [WindOverlay.jsx](file:///d:/New/Apps/UrbanAnalysis/frontend/src/components/WindOverlay.jsx)
- **API Payload:** Attach `"comfort_metric": useStore.getState().windComfortMetric` to the JSON `POST` payload inside `submitGANPayload`.
- **Dependency Array:** Add `useStore.getState().windComfortMetric` to the webhook's `useEffect` dependencies so shifting the criteria instantly recalculates the visualization overlay.

#### [MODIFY] [WindTool.jsx](file:///d:/New/Apps/UrbanAnalysis/frontend/src/tools/WindTool.jsx)
- **UI Element:** Introduce a styled HTML `<select>` below the wind configuration sliders to select between:
  - Raw Speed (Continuous)
  - Lawson Criteria (Proxy)
  - Davenport Criteria (Proxy)
  - NEN 8100 (Proxy)
  - Beaufort Scale
- **Dynamic Legend:** Swap the `<div className="h-2 w-full ...">` gradient bar out with segmented color blocks when a discrete comfort metric is chosen, including descriptive labels for each color (e.g. `Walking`, `Sitting`, `Dangerous`).

## Open Questions

> [!WARNING]
> NEN 8100 is highly granular for probabilities (A/B/C/D/E), but its absolute speed threshold is purely 5m/s for comfort and 15m/s for danger. I'm grouping it into exactly those three proxy areas (`<5` Green, `5-15` Orange, `>15` Red). Is that sufficient, or would you prefer a different cut-off mapping for NEN 8100?

## Verification Plan

### Manual Verification
- Launch the UI and open the wind analysis panel.
- Change the visualization drop-down between Speed, Lawson, NEN 8100, etc.
- Verify the legend changes.
- Verify the GAN accurately renders discrete segmented color blocks when Comfort Metrics are requested instead of continuous flow gradients.
- Ensure the buildings (structures) are not lost in the discrete bins and correctly stand out as dark voids.
