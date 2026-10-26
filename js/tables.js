// Encounter table parsing/validation (CSV + JSON uploads) — no DOM
// ── CSV parser ──────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  // Detect header
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('roll') || first.includes('name') || first.includes('monster');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if(dataLines.length === 0) throw new Error('The CSV has a header but no rows.');

  return dataLines.map((line, i) => {
    // Simple CSV split respecting quoted fields
    const cols = [];
    let cur = '', inQ = false;
    for(let c of line) {
      if(c === '"') { inQ = !inQ; }
      else if(c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cols.push(cur.trim());

    const roll = parseInt(cols[0]) || (i + 1);
    const name = cols[1] || `Monster ${roll}`;
    const cr   = cols[2] || '—';
    const count= cols[3] || '1';
    const desc = cols[4] || '';
    return { roll, name, cr, count, desc };
  });
}

// ── JSON parser ─────────────────────────────────────
function parseJSON(text) {
  const data = JSON.parse(text); // throws on bad JSON
  if(!Array.isArray(data)) throw new Error('The JSON file must be a list of monsters, like [ { "roll": 1, "name": "Ghoul" } ].');
  return data.map((m, i) => {
    if(typeof m !== 'object' || !m) throw new Error(`Row ${i+1} isn't a monster entry.`);
    const roll = parseInt(m.roll) || (i + 1);
    const name = String(m.name || `Monster ${roll}`);
    const cr   = String(m.cr   || '—');
    const count= String(m.count|| '1');
    const desc = String(m.desc || '');
    // Preserve optional rich fields
    const extra = {};
    ['lore','tactics','habitat','stats'].forEach(k => { if(m[k]) extra[k] = m[k]; });
    return { roll, name, cr, count, desc, ...extra };
  });
}

// ── Validate parsed table ───────────────────────────
function validateTable(rows) {
  if(!rows || rows.length === 0) throw new Error('The file has no monsters in it.');
  if(rows.length > 100) throw new Error(`That table has ${rows.length} rows. The limit is 100.`);
  for(const r of rows) {
    if(!r.name || r.name.trim() === '') throw new Error(`Row ${r.roll} has no name.`);
  }
  return rows;
}

// ── Parse file content ──────────────────────────────
function parseTableFile(filename, text) {
  const ext = filename.split('.').pop().toLowerCase();
  let rows;
  if(ext === 'json') {
    rows = parseJSON(text);
  } else {
    // CSV or TXT
    rows = parseCSV(text);
  }
  return validateTable(rows);
}

// Node (test/) import hook — no-op in the browser
if (typeof module !== 'undefined') module.exports = { parseCSV, parseJSON, validateTable, parseTableFile };
