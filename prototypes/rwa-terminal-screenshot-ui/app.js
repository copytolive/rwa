(() => {
  const base = window.RWA_CONFIG || { market: {}, slots: {} };
  const saved = JSON.parse(localStorage.getItem("rwa-terminal-slots") || "{}");
  const slots = Object.fromEntries(
    Object.entries(base.slots).map(([id, value]) => [id, { ...value, ...(saved[id] || {}) }])
  );

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  function bindMarket() {
    $$('[data-market]').forEach(el => {
      const key = el.dataset.market;
      if (base.market[key] != null) el.textContent = base.market[key];
    });
  }

  function paintSlot(el) {
    const id = el.dataset.slot;
    const slot = slots[id];
    if (!slot) return;
    const label = el.querySelector('[data-slot-label]') || el;
    if (label && slot.label != null) label.textContent = slot.label;
    el.dataset.system = slot.system || "";
    el.dataset.action = slot.action || "";
    el.dataset.target = slot.target || "";
    el.toggleAttribute("disabled", slot.enabled === false);
    el.classList.toggle("is-disabled", slot.enabled === false);
    el.title = `${id} · ${slot.system} · ${slot.action} · ${slot.target}`;
  }

  function bindSlots() {
    $$('[data-slot]').forEach(el => {
      paintSlot(el);
      el.addEventListener("click", ev => {
        if (document.body.classList.contains("edit-mode")) {
          ev.preventDefault();
          ev.stopPropagation();
          openEditor(el.dataset.slot);
          return;
        }
        dispatchSlot(el.dataset.slot, ev);
      });
    });
  }

  function dispatchSlot(id, originalEvent) {
    const slot = slots[id];
    if (!slot || slot.enabled === false) return;
    const payload = {
      id,
      ...slot,
      source: document.body.dataset.view || "unknown",
      ts: Date.now(),
      previewOnly: slot.system === "trade-execution",
      originalEventType: originalEvent?.type || "programmatic"
    };
    const adapter = window.RWA_ADAPTERS?.[slot.system];
    if (typeof adapter === "function") adapter(payload);
    else console.info("[unwired slot]", payload);
    flashStatus(`${slot.label} → ${slot.system}/${slot.action}`);
  }

  function ensureEditor() {
    if ($('#slotEditor')) return;
    const pane = document.createElement('aside');
    pane.id = 'slotEditor';
    pane.className = 'slot-editor';
    pane.innerHTML = `
      <div class="slot-editor-head">
        <div><strong>Edit slot</strong><span id="slotEditorId">—</span></div>
        <button id="slotEditorClose" class="icon-btn" aria-label="Close">×</button>
      </div>
      <label>Label<input id="editLabel" /></label>
      <label>System<input id="editSystem" /></label>
      <label>Action<input id="editAction" /></label>
      <label>Target / route / key<input id="editTarget" /></label>
      <label class="switch-row"><span>Enabled</span><input id="editEnabled" type="checkbox" /></label>
      <div class="slot-editor-actions">
        <button id="saveSlot" class="primary-btn">Save slot</button>
        <button id="resetSlot" class="ghost-btn">Reset</button>
      </div>
      <p class="editor-note">Saved locally in this browser. To wire a real system, replace the matching adapter in <code>config.js</code>.</p>`;
    document.body.appendChild(pane);
    $('#slotEditorClose').onclick = () => pane.classList.remove('open');
    $('#saveSlot').onclick = saveEditor;
    $('#resetSlot').onclick = resetEditor;
  }

  let editingId = null;
  function openEditor(id) {
    ensureEditor();
    editingId = id;
    const slot = slots[id];
    if (!slot) return;
    $('#slotEditorId').textContent = id;
    $('#editLabel').value = slot.label || '';
    $('#editSystem').value = slot.system || '';
    $('#editAction').value = slot.action || '';
    $('#editTarget').value = slot.target || '';
    $('#editEnabled').checked = slot.enabled !== false;
    $('#slotEditor').classList.add('open');
  }

  function saveEditor() {
    if (!editingId) return;
    slots[editingId] = {
      ...slots[editingId],
      label: $('#editLabel').value,
      system: $('#editSystem').value,
      action: $('#editAction').value,
      target: $('#editTarget').value,
      enabled: $('#editEnabled').checked
    };
    const allSaved = JSON.parse(localStorage.getItem("rwa-terminal-slots") || "{}");
    allSaved[editingId] = slots[editingId];
    localStorage.setItem("rwa-terminal-slots", JSON.stringify(allSaved));
    $$(`[data-slot="${editingId}"]`).forEach(paintSlot);
    flashStatus(`Saved ${editingId}`);
    $('#slotEditor').classList.remove('open');
  }

  function resetEditor() {
    if (!editingId || !base.slots[editingId]) return;
    const allSaved = JSON.parse(localStorage.getItem("rwa-terminal-slots") || "{}");
    delete allSaved[editingId];
    localStorage.setItem("rwa-terminal-slots", JSON.stringify(allSaved));
    slots[editingId] = { ...base.slots[editingId] };
    $$(`[data-slot="${editingId}"]`).forEach(paintSlot);
    openEditor(editingId);
    flashStatus(`Reset ${editingId}`);
  }

  function flashStatus(text) {
    let el = $('#actionStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'actionStatus';
      el.className = 'action-status';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(flashStatus.t);
    flashStatus.t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function bindEditMode() {
    const toggle = $('#editToggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      document.body.classList.toggle('edit-mode');
      toggle.classList.toggle('active', document.body.classList.contains('edit-mode'));
      toggle.textContent = document.body.classList.contains('edit-mode') ? '✓ Edit mode' : '⚙ Edit slots';
      flashStatus(document.body.classList.contains('edit-mode') ? 'Click any highlighted button/system' : 'Edit mode off');
    });
  }

  function bindTradePreview() {
    window.addEventListener('rwa:trade-preview', e => {
      const slot = e.detail;
      if (slot.id !== 'submitOrder') return;
      const btn = document.querySelector('[data-slot="submitOrder"]');
      if (!btn) return;
      btn.textContent = 'Preview captured ✓';
      setTimeout(() => { paintSlot(btn); }, 1400);
    });
  }

  bindMarket();
  bindSlots();
  bindEditMode();
  bindTradePreview();
})();
