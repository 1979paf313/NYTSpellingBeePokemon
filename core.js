/* Shared puzzle rules, used by the game and its tests. */
(function (root) {
  'use strict';
  function normalizeName(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  }
  function validatePuzzle(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.date || '') ||
        Number.isNaN(Date.parse(value.date + 'T12:00:00Z')) ||
        new Date(value.date + 'T12:00:00Z').toISOString().slice(0, 10) !== value.date) {
      throw new Error('Choose a valid puzzle date.');
    }
    const center = String(value.center || '').toLowerCase();
    const outer = Array.isArray(value.outer) ? value.outer.map(x => String(x).toLowerCase()) : [];
    if (!/^[a-z]$/.test(center) || outer.length !== 6 || outer.some(x => !/^[a-z]$/.test(x)) ||
        new Set([center, ...outer]).size !== 7) {
      throw new Error('Use one center letter and six different outer letters. All seven must be different.');
    }
    return { ...value, center, outer };
  }
  function preparePokemon(items) {
    if (!Array.isArray(items) || !items.length) throw new Error('The Pokémon list is unavailable.');
    return items.map(p => ({ ...p, word: normalizeName(p.name) }));
  }
  function classify(items, puzzle) {
    const p = validatePuzzle(puzzle);
    const letters = new Set([p.center, ...p.outer]);
    const fits = items.filter(x => !/\d/.test(x.name) && x.word.length >= 4 && [...x.word].every(c => letters.has(c)));
    const legal = fits.filter(x => x.word.includes(p.center));
    const relaxed = fits.filter(x => !x.word.includes(p.center));
    return { legal, relaxed, result: legal.length ? 'yes' : relaxed.length ? 'almost' : 'no' };
  }
  const api = { normalizeName, validatePuzzle, preparePokemon, classify };
  root.BeePokemon = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
