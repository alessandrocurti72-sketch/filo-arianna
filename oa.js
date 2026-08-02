// oa.js — Ore Aggiuntive Dashboard v1.0
async function aggiornaOreAgg() {
  const mese = document.getElementById('f-mese').value;
  const tbody = document.getElementById('ore-agg-body');
  if (!mese) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty">Seleziona un mese.</td></tr>';
    return;
  }
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty">Caricamento...</td></tr>';
  try {
    const snapAll = await _getDb().collection('ore_aggiuntive').get();
    const tutti = snapAll.docs.map(d => ({ id: d.id, ...d.data() }));
    const voci = tutti
      .filter(v => v.mese === mese && !v.archiviato)
      .sort((a,b) => (a.data||'').localeCompare(b.data||''));
    document.getElementById('conta-ore-agg').textContent = voci.length + ' voci';
    if (!voci.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">Nessuna voce per ' + mese + '.</td></tr>';
      return;
    }
    const catLabel = { malattia:'🤒 Malattia', ferie:'🏖 Ferie', permesso:'🕐 Permesso', ore_extra:'⏱ Ore Extra', altro:'📋 Altro' };
    tbody.innerHTML = voci.map(v => {
      const [y,m,d] = (v.data||'').split('-');
      const statoHtml = v.stato === 'validato'
        ? '<span class="pill pill-ok">✓ Validato</span>'
        : '<span class="pill pill-open">In attesa</span>';
      const azioni =
        (v.stato !== 'validato' ? '<button onclick="validaOraAgg(\'' + v.id + '\')" style="background:#1a3a5c;border:none;border-radius:4px;padding:3px 8px;color:white;font-size:11px;cursor:pointer;margin-right:4px;">✓</button>' : '') +
        '<button onclick="archiviaOraAgg(\'' + v.id + '\')" title="Archivia" style="background:none;border:1px solid #6b7280;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;color:#6b7280;margin-right:4px;">📦</button>' +
        '<button onclick="eliminaOraAggDash(\'' + v.id + '\',\'' + (v.educatoreNome||'').replace(/'/g,"\\'") + '\')" style="background:none;border:1px solid #b52b2b;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;color:#b52b2b;">🗑</button>';
      return '<tr><td>' + (v.educatoreNome||'—') + '</td><td>' + (d||'')+'/'+( m||'')+'/'+( y||'') + '</td><td>' + (catLabel[v.categoria]||'—') + '</td><td style="font-weight:700;">' + (v.ore||0).toFixed(2) + 'h</td><td style="font-size:11px;color:#6b7280;">' + (v.note||'—') + '</td><td>' + statoHtml + '</td><td>' + azioni + '</td></tr>';
    }).join('');
  } catch(err) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty" style="color:red;">Errore: ' + err.message + '</td></tr>';
    console.error('aggiornaOreAgg:', err);
  }
}
