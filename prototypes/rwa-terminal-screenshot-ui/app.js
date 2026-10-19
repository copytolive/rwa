(() => {
  const defaults = {};
  document.querySelectorAll('[data-slot]').forEach((el) => {
    const id = el.dataset.slot;
    defaults[id] = {
      label: el.dataset.label || el.getAttribute('aria-label') || el.textContent.trim(),
      system: el.dataset.system || 'router',
      action: el.dataset.action || 'open',
      target: el.dataset.target || id,
      enabled: el.dataset.enabled !== 'false'
    };
  });

  const key = `rwa-slot-map:${document.body.dataset.view || 'page'}`;
  const stored = JSON.parse(localStorage.getItem(key) || '{}');
  const map = Object.fromEntries(Object.entries(defaults).map(([k,v]) => [k, {...v, ...(stored[k] || {})}]));

  function apply(id) {
    const slot = map[id];
    document.querySelectorAll(`[data-slot="${id}"]`).forEach(el => {
      el.dataset.system = slot.system;
      el.dataset.action = slot.action;
      el.dataset.target = slot.target;
      el.dataset.enabled = String(slot.enabled);
      const labelNode = el.querySelector('[data-slot-label]');
      if (labelNode) labelNode.textContent = slot.label;
      el.toggleAttribute('disabled', !slot.enabled);
    });
  }
  Object.keys(map).forEach(apply);

  let editing = false;
  let activeId = null;

  const badge = document.createElement('button');
  badge.className = 'edit-badge';
  badge.textContent = 'EDIT SLOTS';
  badge.type = 'button';
  badge.hidden = true;
  document.body.appendChild(badge);

  const panel = document.createElement('div');
  panel.className = 'slot-panel';
  panel.innerHTML = `
    <div class="slot-panel-head"><b>Editable system slot</b><button type="button" data-close>×</button></div>
    <div class="slot-id" data-id>—</div>
    <label>Label<input data-field="label"></label>
    <label>System<input data-field="system"></label>
    <label>Action<input data-field="action"></label>
    <label>Target / route / adapter<input data-field="target"></label>
    <label class="enabled-row"><span>Enabled</span><input type="checkbox" data-field="enabled"></label>
    <div class="slot-actions"><button type="button" data-save>Save</button><button type="button" data-reset>Reset</button></div>
    <small>Ctrl/⌘ + E toggles slot edit mode. Mapping is stored locally only.</small>`;
  document.body.appendChild(panel);

  function toggleEditor(force) {
    editing = typeof force === 'boolean' ? force : !editing;
    document.body.classList.toggle('slot-edit-mode', editing);
    badge.hidden = !editing;
    if (!editing) panel.classList.remove('open');
  }
  badge.addEventListener('click', () => toggleEditor(false));
  panel.querySelector('[data-close]').onclick = () => panel.classList.remove('open');

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault(); toggleEditor();
    }
  });

  document.querySelectorAll('[data-slot]').forEach(el => {
    el.addEventListener('click', (e) => {
      const id = el.dataset.slot;
      if (editing) {
        e.preventDefault(); e.stopPropagation();
        activeId = id;
        const slot = map[id];
        panel.querySelector('[data-id]').textContent = id;
        for (const f of ['label','system','action','target']) panel.querySelector(`[data-field="${f}"]`).value = slot[f] || '';
        panel.querySelector('[data-field="enabled"]').checked = slot.enabled !== false;
        panel.classList.add('open');
        return;
      }
      const slot = map[id];
      window.dispatchEvent(new CustomEvent('rwa:slot', {detail:{id,...slot,view:document.body.dataset.view}}));
    });
  });

  panel.querySelector('[data-save]').onclick = () => {
    if (!activeId) return;
    const next = {};
    for (const f of ['label','system','action','target']) next[f] = panel.querySelector(`[data-field="${f}"]`).value;
    next.enabled = panel.querySelector('[data-field="enabled"]').checked;
    map[activeId] = {...map[activeId], ...next};
    localStorage.setItem(key, JSON.stringify(map));
    apply(activeId);
    panel.classList.remove('open');
  };
  panel.querySelector('[data-reset]').onclick = () => {
    if (!activeId) return;
    map[activeId] = {...defaults[activeId]};
    localStorage.setItem(key, JSON.stringify(map));
    apply(activeId);
    panel.classList.remove('open');
  };
})();