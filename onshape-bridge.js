/*
 * Onshape Element Right Panel bridge for native selection capture.
 * Supported native viewport picks: BODY (unbounded until Finish) and EDGE (one pick).
 * Mate identity is supplied by a second Element Right Panel extension configured
 * for the Mate context, which passes {$nodeId} and {$occurrencePath} in its URL.
 */
(() => {
  const q = new URLSearchParams(location.search);
  const context = {
    documentId: q.get('documentId'),
    workspaceId: q.get('workspaceId') || q.get('versionId') || q.get('microversionId'),
    elementId: q.get('elementId'),
    server: q.get('server'),
    companyId: q.get('companyId'),
    userId: q.get('userId'),
    nodeId: q.get('nodeId'),
    occurrencePath: q.get('occurrencePath'),
    context: q.get('context')
  };
  const hasDocumentContext = Boolean(context.documentId && context.workspaceId && context.elementId && context.server);
  const inOnshape = hasDocumentContext && window.parent !== window;
  let activeRequest = null;
  let selectedBodies = [];
  let gravityEdge = null;
  let mateContext = context.nodeId ? { nodeId: context.nodeId, occurrencePath: context.occurrencePath } : null;
  let latestSelection = null;
  const status = document.getElementById('onshapeStatus');
  const contextLabel = document.getElementById('onshapeContext');
  const output = document.getElementById('selectionData');
  const parentOrigin = (() => { try { return new URL(context.server).origin; } catch { return null; } })();

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(`armoptimizer:${name}`, { detail }));
  }
  function updateOutput() {
    if (!output) return;
    output.textContent = JSON.stringify({
      selectedBodies,
      gravityEdge,
      mateContext,
      latestSelection
    }, null, 2);
  }
  function send(message) {
    if (!inOnshape) throw new Error('Open this app from an Onshape document extension first.');
    window.parent.postMessage({
      documentId: context.documentId,
      workspaceId: context.workspaceId,
      elementId: context.elementId,
      ...message
    }, parentOrigin || '*');
  }
  function selectionItems(data) {
    const candidates = data.selections ?? data.selection ?? data.entities ?? data.selectedEntities ?? data;
    if (Array.isArray(candidates)) return candidates;
    if (candidates && typeof candidates === 'object') return [candidates];
    return [];
  }
  function stableKey(item) {
    const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
      ? Object.keys(value).sort().reduce((out, key) => (out[key] = canonical(value[key]), out), {}) : value;
    return JSON.stringify(canonical(item));
  }
  function requestBodies() {
    if (activeRequest) stopSelection();
    activeRequest = { id: crypto.randomUUID(), kind: 'BODY' };
    send({ messageName: 'requestSelection', messageId: activeRequest.id, entityTypeSpecifier: ['BODY'], requiredSelectionCount: 0 });
    if (status) status.textContent = 'Select arm bodies in Onshape; click Finish when done';
    emit('request-state', { active: true, kind: 'BODY' });
  }
  function requestGravityEdge() {
    if (activeRequest) stopSelection();
    activeRequest = { id: crypto.randomUUID(), kind: 'EDGE' };
    send({ messageName: 'requestSelection', messageId: activeRequest.id, entityTypeSpecifier: ['EDGE'], requiredSelectionCount: 1 });
    if (status) status.textContent = 'Select one gravity reference edge';
    emit('request-state', { active: true, kind: 'EDGE' });
  }
  function stopSelection() {
    if (!activeRequest) return;
    send({ messageName: 'stopRequest' });
    const previous = activeRequest;
    activeRequest = null;
    emit('request-state', { active: false, kind: previous.kind });
    if (status) status.textContent = 'Selection request finished';
  }
  function clear() {
    if (activeRequest) stopSelection();
    selectedBodies = [];
    gravityEdge = null;
    latestSelection = null;
    updateOutput();
    emit('selection-updated', snapshot());
  }
  function snapshot() {
    return { selectedBodies: [...selectedBodies], gravityEdge, mateContext, latestSelection };
  }

  if (status) {
    if (inOnshape) {
      status.textContent = 'Connecting to Onshape…';
      if (contextLabel) contextLabel.textContent = `Document ${context.documentId.slice(0, 8)}…`;
      // Onshape starts sending selection messages only after this handshake.
      send({ messageName: 'applicationInit' });
    } else {
      status.textContent = 'Standalone mode — Onshape selection unavailable';
    }
  }

  // A Mate-context Element Right Panel launch supplies these URL substitutions.
  if (context.nodeId) {
    mateContext = { nodeId: context.nodeId, occurrencePath: context.occurrencePath };
    emit('mate-context', { ...mateContext, context: context.context });
    if (status) status.textContent = inOnshape
      ? 'Mate context received from Assembly tree'
      : 'Mate ID received, but open this extension inside Onshape to select geometry';
    updateOutput();
  }

  window.addEventListener('message', event => {
    if (!inOnshape || (parentOrigin && event.origin !== parentOrigin)) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.messageName === 'SELECTION') {
      latestSelection = data;
      const items = selectionItems(data);
      if (activeRequest?.kind === 'BODY') {
        for (const item of items) {
          const type = String(item.entityType || item.selectionType || item.type || '').toUpperCase();
          // A BODY request should only collect body picks. Preserve raw selection objects
          // because occurrence paths and IDs are needed for later mass-property integration.
          if (!type || type === 'BODY' || type === 'SOLID' || type === 'UNKNOWN') {
            const key = stableKey(item);
            if (!selectedBodies.some(existing => stableKey(existing) === key)) selectedBodies.push(item);
          }
        }
      } else if (activeRequest?.kind === 'EDGE') {
        const item = items[0];
        if (item) gravityEdge = item;
        activeRequest = null;
        emit('request-state', { active: false, kind: 'EDGE' });
      }
      updateOutput();
      emit('selection-updated', snapshot());
      if (status) status.textContent = activeRequest?.kind === 'BODY'
        ? `${selectedBodies.length} body selection(s) captured — click Finish`
        : gravityEdge ? 'Gravity edge captured' : 'Onshape selection received';
    } else if (data.messageName === 'stopRequest') {
      activeRequest = null;
      emit('request-state', { active: false });
    }
  });

  document.getElementById('selectBodies')?.addEventListener('click', () => {
    try { requestBodies(); } catch (e) { if (status) status.textContent = e.message; }
  });
  document.getElementById('finishBodySelection')?.addEventListener('click', () => {
    try { stopSelection(); } catch (e) { if (status) status.textContent = e.message; }
  });
  document.getElementById('selectGravityEdge')?.addEventListener('click', () => {
    try { requestGravityEdge(); } catch (e) { if (status) status.textContent = e.message; }
  });
  document.getElementById('clearCadSelection')?.addEventListener('click', clear);
  document.getElementById('captureSelection')?.addEventListener('click', updateOutput);
  document.getElementById('clearSelection')?.addEventListener('click', clear);

  window.ArmOptimizerOnshape = {
    context,
    inOnshape,
    requestBodies,
    requestGravityEdge,
    stopSelection,
    clear,
    snapshot,
    getLatestSelection: () => latestSelection
  };
})();
