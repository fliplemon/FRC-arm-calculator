# Arm Gear Ratio Optimizer

A browser-based prototype for sizing a single-axis FRC arm reduction. It combines entered component mass properties, pivot/gravity vectors, one or more motor models, current limits, and a numerically simulated move between angular setpoints.

## Run locally

```bash
npm install
npm start
```

Then visit `http://localhost:4173`. The standalone calculator works locally. Onshape selection requests work only when the app is loaded as an embedded Onshape extension from an HTTPS origin.

## Current features

- Add/remove arm components; enter mass, center of mass, and symmetric inertia tensor about each component COM.
- Calculate total mass, combined COM, and pivot-axis inertia with the parallel-axis theorem.
- Define pivot point and axis, gravity vector and magnitude, start/target angles.
- Enter initial and final angular velocities in Advanced settings (both default to zero).
- Add/remove multiple motors, each with its own model/custom motor constants and current limit.
- Motor library: NEO, NEO 550, Falcon 500, Kraken X60, CIM, Mini CIM, and 775pro. Verify constants against current manufacturer data before design use.
- DC motor electrical model with winding resistance, back-EMF, and per-motor current clamping.
- Gear-ratio sweep, local refinement, feasibility detection, trajectory plots, and CSV export.

## Milestone 1: Onshape selection bridge

Implemented in this version:

- Detects the Onshape embedded-app context and sends the required `applicationInit` handshake.
- Requests multiple `BODY` selections from the native Onshape viewport. The user clicks **Finish body selection** to stop the unbounded selection request.
- Requests one `EDGE` selection for the gravity reference.
- Validates incoming `postMessage` events against the `server` origin supplied by Onshape.
- Retains the raw selection payloads and displays a summary in the app. The raw references are intentionally preserved for Milestone 2.
- Receives a pivot mate's `nodeId` and `occurrencePath` when the app is launched in the `Mate` context of an Element Right Panel extension. `requestSelection` does not support mates, so the mate is obtained from the Assembly tree context instead.

**Not included yet:** automatic mass-property retrieval, transforming component COM/inertia into assembly coordinates, resolving the revolute mate's connector origin/axis, or converting the selected gravity edge into a gravity vector. Milestone 1 captures references only; the calculator's numeric mass-property and pivot/gravity inputs remain manual/imported.

## Configure the Onshape extensions

Follow the step-by-step guide in [`ONSHAPE-SETUP.md`](./ONSHAPE-SETUP.md). You need two extensions on the same registered Onshape application:

1. **Element Right Panel (Assembly context)** — embeds the calculator UI and enables BODY/EDGE selection requests. Its action URL must pass `documentId`, `workspaceId`, and `elementId` using Onshape substitutions.
2. **Element Right Panel (Mate context)** — loads the same UI with those document parameters plus the selected mate's `nodeId` and `occurrencePath`.

Use an HTTPS public deployment URL. The local `http://localhost:4173` server is useful for calculator development but is not a suitable production extension URL. For local testing, use an HTTPS development tunnel and configure that exact HTTPS origin in Onshape.

## Security and deployment

- The current `server.js` is only a static Express host and an earlier API scaffold. Milestone 1 does not require an Onshape API token or OAuth access token because the viewport selection bridge uses Onshape client messaging.
- Do not put Onshape client secrets or access tokens in browser JavaScript.
- For Milestone 2, implement server-side OAuth2 and the required authenticated REST calls. The existing API proxy should not be treated as production-ready OAuth.
- Keep the embedded app at the same HTTPS origin throughout its session. Onshape validates message origins.

## Physics model and limitations

For each motor, at motor speed `|ωm|`, approximate available current is

`I = min(I_limit, max(0, (V_bus - Ke |ωm|) / R))`

and motor torque is `τm = Kt I`. `R = V_rated / I_stall`, `Ke = (V_rated - I_free R) / ω_free`, and `Kt = τ_stall / I_stall`. The model sums motor torques through a common reduction and gearbox efficiency. It does not model controller commutation details, motor temperature, battery sag, or regenerative braking limits.

The arm is treated as rigid and single-axis. The simulator uses a finite time step and a bang-bang-style acceleration/braking heuristic to estimate a fast move satisfying terminal position/velocity tolerances. It is a numerical sizing estimate, not a formal global-optimality proof. It does not model friction, backlash, structural flex, hard-stop impacts, controller latency, or detailed controller behavior.

For a real FRC design, validate the selected reduction with a more detailed model and test safely with current limits, mechanical stops, and an appropriate control loop.

## Component JSON format

See `component-import-example.json`. Coordinates are meters in one shared assembly coordinate frame. Inertia tensor entries are kg·m² about each component's own COM, expressed in the same frame. The pivot and axis are expressed in that same frame. For repeated occurrences, include each occurrence separately.
