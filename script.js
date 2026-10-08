(() => {
  'use strict';
  const { normalizeName, validatePuzzle, preparePokemon, classify } = BeePokemon;
  const $ = id => document.getElementById(id);
  let pokemon = [], daily = null, active = null, matches = null, mode = 'daily';
  let found = new Set(), hasRevealed = false, history = null, historyPromise = null;
  const readJSON = async path => {
    const response = await fetch(path + '?v=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load ' + path + '.');
    return response.json();
  };
  const dateLabel = date => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
  function easternDate() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function progressKey() { return 'bee-pokemon-v1:' + active.date + ':' + active.center + ':' + [...active.outer].sort().join(''); }
  function saveProgress() {
    try { localStorage.setItem(progressKey(), JSON.stringify({ found: [...found], revealed: hasRevealed })); } catch (_) { /* Private browsing can block storage. */ }
  }
  function restoreProgress() {
    found = new Set(); hasRevealed = false;
    try {
      const data = JSON.parse(localStorage.getItem(progressKey()) || 'null');
      const ids = new Set([...matches.legal, ...matches.relaxed].map(p => p.id));
      if (data && Array.isArray(data.found)) found = new Set(data.found.filter(id => ids.has(id)));
      hasRevealed = data?.revealed === true;
    } catch (_) { /* A damaged save shouldn't stop the game. */ }
  }
  function feedback(text, good = null) {
    $('feedback').textContent = text;
    $('feedback').className = 'feedback' + (good === true ? ' good' : good === false ? ' bad' : '');
  }
  function paintProgress() {
    const legalFound = matches.legal.filter(p => found.has(p.id));
    const relaxedFound = matches.relaxed.filter(p => found.has(p.id));
    const target = matches.result === 'yes' ? matches.legal : matches.relaxed;
    const count = matches.result === 'yes' ? legalFound.length : relaxedFound.length;
    $('progress').textContent = target.length ? `${count} of ${target.length} found${matches.result === 'yes' && relaxedFound.length ? ' · ' + relaxedFound.length + ' center-free bonus' : ''}` : '';
    $('found-list').replaceChildren();
    for (const p of [...legalFound, ...relaxedFound]) {
      const li = document.createElement('li');
      li.textContent = p.name + (matches.result === 'yes' && !p.word.includes(active.center) ? ' · no center' : '');
      if (!p.word.includes(active.center)) li.classList.add('bonus');
      $('found-list').append(li);
    }
  }
  function paintReveal() {
    $('revealed').replaceChildren();
    $('revealed').hidden = !hasRevealed;
    $('reveal').textContent = hasRevealed ? 'Hide answers' : 'Reveal answers';
    if (!hasRevealed) return;
    for (const [items, title] of [[matches.legal, 'Uses the center letter'], [matches.relaxed, 'Only without the center letter']]) {
      if (!items.length) continue;
      const heading = document.createElement('h3'); heading.textContent = title;
      const ul = document.createElement('ul');
      for (const p of items) {
        const li = document.createElement('li'); li.textContent = p.name;
        if (new Set(p.word).size === 7) li.textContent += ' · pangram';
        ul.append(li);
      }
      $('revealed').append(heading, ul);
    }
  }
  function showPuzzle(value, nextMode) {
    active = validatePuzzle(value); mode = nextMode;
    matches = classify(pokemon, active);
    restoreProgress();
    $('load-message').hidden = true; $('game').hidden = false;
    const stale = mode === 'daily' && active.date !== easternDate();
    const prefix = mode === 'manual' ? 'Your letters' : mode === 'archive' ? 'Past Bee' : stale ? 'Latest available Bee' : "Today's Bee";
    $('puzzle-date').textContent = `${prefix} · ${dateLabel(active.date)}`;
    $('freshness').hidden = !stale && mode !== 'manual';
    $('freshness').textContent = mode === 'manual' ? 'These letters are on your screen. The published daily Bee is unchanged.' : stale ? `These are the ${dateLabel(active.date)} letters. The next daily set hasn't arrived here yet. You can enter it below.` : '';
    $('hive').replaceChildren();
    for (const [i, letter] of [active.center, ...active.outer].entries()) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'hex' + (i === 0 ? ' center' : '');
      button.textContent = letter.toUpperCase();
      button.setAttribute('aria-label', letter.toUpperCase() + (i === 0 ? ', required center letter' : ', outer letter') + '. Add to guess.');
      button.addEventListener('click', () => { $('guess').value += letter; $('guess').focus(); });
      $('hive').append(button);
    }
    $('outcome').className = matches.result;
    $('outcome').textContent = { yes: 'YES.', almost: 'ALMOST.', no: 'NO.' }[matches.result];
    $('outcome-detail').textContent = matches.result === 'yes'
      ? `${matches.legal.length === 1 ? 'One Pokémon fits' : matches.legal.length + ' Pokémon fit'} the letters and use${matches.legal.length === 1 ? 's' : ''} the center. Can you find ${matches.legal.length === 1 ? 'it' : 'them'}?`
      : matches.result === 'almost'
      ? `${matches.relaxed.length === 1 ? 'One Pokémon fits' : matches.relaxed.length + ' Pokémon fit'} — if you skip the center letter. Can you find ${matches.relaxed.length === 1 ? 'it' : 'them'}?`
      : 'No Pokémon fits these letters, even if you skip the center. Try a past Bee, or come back tomorrow.';
    $('guess-form').hidden = matches.result === 'no'; $('reveal').hidden = matches.result === 'no';
    $('guess').value = ''; feedback(''); paintProgress(); paintReveal();
  }
  $('guess-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('guess').value.trim(), word = normalizeName(input);
    if (!word) { feedback('Enter a Pokémon name.', false); return; }
    if (/\d/.test(input)) { feedback('Names containing digits do not count.', false); return; }
    const named = pokemon.filter(p => p.word === word);
    if (!named.length) { feedback('That name isn’t in the species list. Check the spelling.', false); return; }
    if (word.length < 4) { feedback('The Bee needs at least four letters. This name is too short.', false); return; }
    const letters = new Set([active.center, ...active.outer]);
    const missing = [...new Set([...word].filter(c => !letters.has(c)))];
    if (missing.length) { feedback('That name needs ' + missing.map(c => c.toUpperCase()).join(', ') + ', which isn’t in the hive.', false); return; }
    if (named.every(p => found.has(p.id))) { feedback('You already found ' + named.map(p => p.name).join(' and ') + '.'); return; }
    named.forEach(p => found.add(p.id));
    const usesCenter = word.includes(active.center);
    feedback(named.map(p => p.name).join(' and ') + (usesCenter ? ' — found!' : ` fits, but skips ${active.center.toUpperCase()}.${matches.result === 'yes' ? ' A center-free bonus!' : ' Found!'}`), true);
    $('guess').value = ''; paintProgress(); saveProgress();
  });
  $('reveal').addEventListener('click', () => { hasRevealed = !hasRevealed; paintReveal(); saveProgress(); });
  $('share').addEventListener('click', async () => {
    const target = matches.result === 'yes' ? matches.legal : matches.relaxed;
    const n = target.filter(p => found.has(p.id)).length;
    const url = location.origin + location.pathname;
    const text = `Pokémon in the Bee · ${active.date}${mode === 'manual' ? ' · custom letters' : ''}\n${{ yes: 'YES 🟩', almost: 'ALMOST 🟨', no: 'NO ⬜' }[matches.result]}${target.length ? ` · ${n}/${target.length} found` : ''}${hasRevealed ? ' · answers revealed' : ''}\n${url}`;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); feedback('Result copied. No Pokémon names included.'); }
      else window.prompt('Copy your result:', text);
    } catch (_) { window.prompt('Copy your result:', text); }
  });
  $('manual-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!pokemon.length) { $('manual-feedback').textContent = 'The Pokémon list didn’t load. Refresh the page and try again.'; return; }
    const fields = new FormData(event.currentTarget);
    const raw = String(fields.get('outer')).trim();
    if (/[^a-z\s,]/i.test(raw)) { $('manual-feedback').textContent = 'Enter just letters, with optional spaces or commas.'; return; }
    try {
      showPuzzle({ date: easternDate(), center: String(fields.get('center')).trim(), outer: raw.replace(/[\s,]/g, '').split('') }, 'manual');
      $('manual-feedback').textContent = '';
      $('game').scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (error) { $('manual-feedback').textContent = error.message; }
  });
  $('back-daily').addEventListener('click', () => {
    if (daily) { showPuzzle(daily, 'daily'); $('manual-feedback').textContent = ''; }
    else $('manual-feedback').textContent = 'The daily letters didn’t load. Refresh to try again.';
  });
  async function loadHistory() {
    if (history) return history;
    if (!historyPromise) historyPromise = readJSON('data/history.json').then(value => {
      if (!Array.isArray(value.puzzles) || !value.puzzles.length || !value.stats) throw new Error('The archive is unavailable.');
      history = value;
      const s = value.stats;
      $('stats').replaceChildren();
      for (const [key, label] of [['yes', 'YES'], ['almost', 'ALMOST'], ['no', 'NO']]) {
        const block = document.createElement('div'); block.className = 'stat';
        const percent = document.createElement('strong'); percent.className = key; percent.textContent = (100 * s.counts[key] / s.total).toFixed(1) + '%';
        const caption = document.createElement('span'); caption.textContent = label + ' · ' + s.counts[key].toLocaleString() + ' Bees';
        block.append(percent, caption); $('stats').append(block);
      }
      $('history-note').textContent = `${s.total.toLocaleString()} recorded Bees, ${dateLabel(s.start)}–${dateLabel(s.end)}. Every puzzle is checked against the same current species list; this isn't limited to Pokémon released at the time. Missing dates aren't filled in.`;
      $('top-pokemon').replaceChildren();
      for (const p of s.top.slice(0, 10)) { const li = document.createElement('li'); li.textContent = `${p.name} · ${p.count} Bees`; $('top-pokemon').append(li); }
      $('archive-date').min = s.start; $('archive-date').max = s.end; $('archive-date').value = s.end;
      $('history-status').hidden = true; $('history-content').hidden = false;
      return history;
    }).catch(error => { historyPromise = null; $('history-status').textContent = 'The archive didn’t load. Close and reopen this section to retry.'; throw error; });
    return historyPromise;
  }
  $('history-panel').addEventListener('toggle', () => { if ($('history-panel').open) loadHistory().catch(() => {}); });
  $('archive-form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const archive = await loadHistory();
      const puzzle = archive.puzzles.find(p => p.date === $('archive-date').value);
      if (!puzzle) { $('history-note').textContent = 'That date is missing from this archive. Choose another date.'; return; }
      if (!pokemon.length) throw new Error('The Pokémon list didn’t load. Refresh and try again.');
      showPuzzle(puzzle, 'archive'); $('game').scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (error) { $('history-note').textContent = error.message; }
  });
  async function init() {
    const results = await Promise.allSettled([readJSON('data/pokemon.json'), readJSON('data/daily-bee.json')]);
    try {
      if (results[0].status !== 'fulfilled') throw new Error('The Pokémon list didn’t load. Refresh to retry.');
      pokemon = preparePokemon(results[0].value.pokemon);
      if (results[1].status !== 'fulfilled') throw new Error('The daily letters didn’t load. You can enter them yourself below.');
      daily = validatePuzzle(results[1].value); showPuzzle(daily, 'daily');
    } catch (error) { $('load-message').textContent = error.message; }
  }
  init();
})();
