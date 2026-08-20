(() => {
  const KEY = 'everlumeResearchListV1';
  const listeners = new Set();
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  };
  const write = items => {
    localStorage.setItem(KEY, JSON.stringify(items));
    listeners.forEach(listener => listener(items));
    window.dispatchEvent(new CustomEvent('everlume:research-list', { detail: items }));
    return items;
  };
  window.everlumeResearchList = {
    list: read,
    has: id => read().some(item => item.id === id),
    save(item) {
      const clean = {
        id: `${item.slug}::${item.dose || ''}`,
        slug: String(item.slug || ''), name: String(item.name || ''),
        dose: String(item.dose || ''), sku: String(item.sku || ''),
        category: String(item.category || ''), savedAt: new Date().toISOString()
      };
      return write([clean, ...read().filter(entry => entry.id !== clean.id)].slice(0, 24));
    },
    remove: id => write(read().filter(item => item.id !== id)),
    clear: () => write([]),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
})();
