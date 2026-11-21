// Minimal same-origin proxy for personal Onshape API testing.
// Do not expose ONSHAPE_ACCESS_TOKEN to browser code or commit it.
const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
app.use(express.json({limit:'1mb'}));
app.use(express.static(__dirname));

app.get('/api/onshape/assembly', async (req,res) => {
  try {
    const {documentId, workspaceId, elementId} = req.query;
    if (!documentId || !workspaceId || !elementId) return res.status(400).json({error:'documentId, workspaceId, and elementId are required'});
    if (!process.env.ONSHAPE_ACCESS_TOKEN) return res.status(503).json({error:'Onshape API is not configured. Set ONSHAPE_ACCESS_TOKEN in the server environment. For a distributable app, replace this personal token mechanism with registered OAuth2.'});
    const base = process.env.ONSHAPE_BASE_URL || 'https://cad.onshape.com';
    const apiVersion = process.env.ONSHAPE_API_VERSION || 'v17';
    const root = `${base}/api/${apiVersion}/assemblies/d/${encodeURIComponent(documentId)}/w/${encodeURIComponent(workspaceId)}/e/${encodeURIComponent(elementId)}`;
    const headers = {Authorization:`Bearer ${process.env.ONSHAPE_ACCESS_TOKEN}`,Accept:'application/json;charset=UTF-8'};
    const [definition, massProperties] = await Promise.all([
      fetch(`${root}?includeMateFeatures=true&includeNonSolids=false&includeMateConnectors=true&excludeSuppressed=false`,{headers}),
      fetch(`${root}/massproperties`,{headers})
    ]);
    const parse = async r => { const body=await r.text(); let json; try{json=JSON.parse(body)}catch{json={raw:body}}; if(!r.ok)throw new Error(`Onshape API ${r.status}: ${JSON.stringify(json)}`); return json; };
    const [assembly, mass] = await Promise.all([parse(definition),parse(massProperties)]);
    res.json({assembly,massProperties:mass,notice:'Assembly-level mass properties are supplied by Onshape. Per-selected-instance mass-property aggregation and coordinate transformation must be applied before using this data in the optimizer.'});
  } catch (e) { res.status(502).json({error:e.message}); }
});
const port = Number(process.env.PORT || 4173);
app.listen(port,()=>console.log(`Arm Gear Ratio Optimizer running at http://localhost:${port}`));
