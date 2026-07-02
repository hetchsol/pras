// Shared Stock Items catalog helpers for the Stores forms (GRN, Issue Slip).
// item_code is the primary key tying these forms to the Stock Items
// catalog, so lookups here must normalize the same way the backend does
// (trim + uppercase) to avoid missing a match on case/whitespace alone.

async function fetchStockItemsCatalog() {
  try {
    const apiUrl = window.API_URL || 'http://localhost:3001/api';
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${apiUrl}/stores/stock-items`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('Failed to load stock items catalog', e);
    return [];
  }
}

function populateStockItemsDatalist(datalistEl, items) {
  if (!datalistEl) return;
  datalistEl.innerHTML = '';
  (items || []).filter(i => i.item_number).forEach(i => {
    const opt = document.createElement('option');
    opt.value = i.item_number;
    const parts = [i.item_description, i.pump_model, i.material].filter(Boolean);
    opt.textContent = parts.join(' — ');
    datalistEl.appendChild(opt);
  });
}

function lookupStockItemByCode(items, code) {
  if (!code) return null;
  const norm = code.trim().toUpperCase();
  return (items || []).find(i => (i.item_number || '').trim().toUpperCase() === norm) || null;
}
