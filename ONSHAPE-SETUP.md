# Onshape setup: Milestone 1

This guide configures the native selection workflow. It does not configure automatic mass properties or the full OAuth-backed REST API; those belong to Milestone 2.

## 1. Host the application over HTTPS

1. Deploy this project to a host that serves the Express app in `server.js` (or another static/Node host).
2. Confirm the deployed root URL serves `index.html` and that `/onshape-bridge.js` and `/app.js` load from the same origin.
3. Confirm the site uses HTTPS. Example shape: `https://your-app.example.com/`.
4. For development, you can run `npm install` and `npm start`, then expose port `4173` through an HTTPS development tunnel. Use the tunnel's HTTPS URL in Onshape.

Do not use a URL that redirects to a different hostname after the iframe loads; the message-origin check expects the original origin.

## 2. Register an Onshape application

1. In Onshape, open **My Account** (individual account) or the relevant company/classroom developer settings.
2. Open **Developer Portal / OAuth Applications** (the exact menu label can vary).
3. Create an application for internal development/testing and complete the required application metadata.
4. Keep any OAuth client secret private. Milestone 1's selection messaging does not consume the OAuth token, but the registered app is needed to create Onshape extensions.
5. Open the application's **Extensions** tab.

Onshape's current developer guide: https://onshape-public.github.io/docs/app-dev/extensions/

## 3. Add the embedded calculator extension

Create an extension with these settings (labels may vary slightly in the Onshape UI):

- **Name:** Arm Gear Ratio Optimizer
- **Location:** Element Right Panel
- **Context:** Assembly
- **Action URL:** `https://YOUR-HTTPS-HOST/?documentId={$documentId}&workspaceId={$workspaceOrVersionId}&elementId={$elementId}`
- **Action type:** Not applicable for an embedded UI extension

The Element Right Panel extension URL must explicitly include the document, workspace/version, and element substitutions. Onshape appends its `server` query parameter (and other default context parameters) automatically.

Save it. Open an Assembly document and launch the extension from the right panel. It should show **Onshape iframe detected** (or a document-context status) rather than standalone mode.

The extension sends `applicationInit` after startup. This handshake is required before Onshape sends selection events.

## 4. Add a Mate-context right-panel extension

Onshape's viewport `requestSelection` message supports BODY and EDGE (among other geometric entity types), but not MATE. The supported way to obtain a mate reference is to launch an extension in the Assembly tree's `Mate` context. The Element Right Panel extension location supports `Mate` as a context and passes `nodeId` and `occurrencePath` into the application URL.

Create a second extension on the same registered Onshape application:

- **Name:** Arm Gear Ratio Optimizer — Mate context
- **Location:** Element Right Panel
- **Context:** Mate
- **Action URL:** `https://YOUR-HTTPS-HOST/?documentId={$documentId}&workspaceId={$workspaceOrVersionId}&elementId={$elementId}&nodeId={$nodeId}&occurrencePath={$occurrencePath}`
- **Action type:** Not applicable for an embedded UI extension

The Element Right Panel extension URL must explicitly include the document, workspace/version, element, mate node, and occurrence-path substitutions. Onshape appends its `server` query parameter (and other default context parameters) automatically.

Save the extension. In an Assembly, select the revolute mate in the Assembly tree and open the Mate-context optimizer extension from the right panel. The app should display **Mate context received from Assembly tree** and show the mate node ID in the CAD selection summary.

Use the Assembly-context extension when you want to open the calculator generally. Use the Mate-context extension when you want the app to receive the selected mate identity. Both extensions load the same app and can request BODY/EDGE selections from the viewport.

## 5. Test BODY selection

1. Keep the calculator open in the Assembly right panel.
2. Click **1 · Select arm bodies**.
3. Click the solid bodies that move with the arm in the viewport. Select all relevant bodies, including hardware that contributes meaningful mass/inertia.
4. Click **Finish body selection** in the calculator.
5. Confirm the summary reports the number of captured body selections.
6. Expand **Raw Onshape selection data (debug)** and inspect the references. The app preserves the raw payload because the exact entity/occurrence identifiers are needed by Milestone 2.

The request is unbounded until Finish is clicked. If the request remains active, click Finish before starting another selection request.

## 6. Test gravity EDGE selection

1. Click **2 · Select gravity edge**.
2. Select one straight edge whose direction represents the desired gravity reference direction.
3. Confirm the app reports **Gravity edge: captured**.

Milestone 1 only captures the selected edge reference. It does not yet compute its 3D direction, and it does not decide whether the edge direction represents gravity-up or gravity-down. Those decisions and the edge geometry lookup are part of Milestone 2.

## 7. Troubleshooting

- **Standalone mode:** The page was opened directly, not inside the Onshape Element Right Panel. Use the configured extension inside an Assembly.
- **No selection arrives:** Verify that the extension is Element Right Panel, the app sends `applicationInit`, the page remains on the same HTTPS origin, and the `server` query parameter matches the actual Onshape origin.
- **Wrong origin / ignored messages:** Avoid redirects between hostnames and deploy the page and scripts from one stable HTTPS origin.
- **Mate context not transferred:** Confirm the second extension is Element Right Panel with Context = Mate. Verify that the app URL is configured as the extension action URL and that Onshape is passing `nodeId` and `occurrencePath` query parameters.
- **Bodies are captured but calculator mass fields stay unchanged:** This is expected in Milestone 1. Automatic CAD mass-property retrieval and coordinate transforms are Milestone 2.

## Official documentation

- Extensions and context-menu configuration: https://onshape-public.github.io/docs/app-dev/extensions/
- Element Right Panel messaging, including `applicationInit`, `requestSelection`, `stopRequest`, and security checks: https://onshape-public.github.io/docs/app-dev/messages/element-right-panel/
- General Onshape client messaging: https://onshape-public.github.io/docs/app-dev/messages/
