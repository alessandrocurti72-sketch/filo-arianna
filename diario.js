// diario.js — Logica Diario di Bordo
// Il Filo di Arianna – Presenze PWA

// ── STATO DIARIO ──

let diarioMinori = [];
let diarioNoteCorrente = [];
let diarioMinoreSelezionato = null;
let diarioFiltroArea = 'tutti';
let diarioNoteCount = {}; // { minoreId: { scol: N, dom: N } } — note da leggere per area

// ── INIT DIARIO ──

async function initDiario() {
  // Mostra/nascondi sezioni in base al ruolo
  const ruolo = currentEdu.ruolo || '';
  const area = currentEdu.area || '';
  const isMicronido = area === 'micronido';

  if (isMicronido) {
    // Non dovrebbe mai arrivarci, ma per sicurezza
    navTo('timbra', document.querySelector('.nb'));
    return;
  }

  const isCoord = ruolo === 'coordinatore_pedagogico' || ruolo === 'coordinatore_area';

  // Mostra badge urgenze se coordinatore
  if (isCoord) {
    await aggiornaContatoreBadge();
  }

  await caricaMinoriDiario();
  renderListaMinori();
  // Carica badge servizi in background
  renderListaServizi().catch(function() {});
}

// ── CARICAMENTO MINORI ──

async function caricaMinoriDiario() {
  try {
    diarioMinori = await syncGetMinori();
  } catch (err) {
    diarioMinori = [];
    toast('Errore caricamento minori: ' + err.message);
  }
  // Carica conteggio note da leggere per tutti i minori
  await caricaNoteCount();
}

async function caricaNoteCount() {
  diarioNoteCount = {};
  if (!diarioMinori.length) return;
  try {
    const snap = await col('diario').get();
    const tutte = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const isCoord = currentEdu.ruolo === 'coordinatore_pedagogico' || currentEdu.ruolo === 'coordinatore_area';

    tutte.forEach(function(nota) {
      const minoreId = nota.minoreId;
      if (!minoreId) return;

      const minore = diarioMinori.find(m => m.id === minoreId);
      if (!minore) return;

      if (!diarioNoteCount[minoreId]) diarioNoteCount[minoreId] = { scol: 0, dom: 0, scolTot: 0, domTot: 0 };

      const autoreId = nota.autoreId;
      const isScolastica = autoreId === minore.educatoreIdScolastico || autoreId === minore.educatoreIdScolastico2;
      const isDomiciliare = autoreId === minore.educatoreIdExtra;
      const area = isScolastica ? 'scol' : isDomiciliare ? 'dom' : 'scol';

      // Totale note (per coordinatore)
      diarioNoteCount[minoreId][area + 'Tot']++;

      // Note non lette (per tutti)
      const giaLetta = (nota.vistoDA || []).some(v => v.id === currentEdu.id);
      if (!giaLetta) {
        diarioNoteCount[minoreId][area]++;
      }
    });
  } catch(e) { /* ignora */ }
}

function badgeNoteListe(minoreId, aree) {
  const cnt = diarioNoteCount[minoreId];
  if (!cnt) return '';
  const isCoord = currentEdu.ruolo === 'coordinatore_pedagogico' || currentEdu.ruolo === 'coordinatore_area';
  let html = '';

  if (isCoord) {
    // Coordinatore: mostra totale note, con cerchio pieno se ci sono non lette
    const scolTot = (aree === 'scolastico' || aree === 'entrambe') ? cnt.scolTot : 0;
    const domTot = (aree === 'domiciliare' || aree === 'entrambe') ? cnt.domTot : 0;
    const scolNonLette = (aree === 'scolastico' || aree === 'entrambe') ? cnt.scol : 0;
    const domNonLette = (aree === 'domiciliare' || aree === 'entrambe') ? cnt.dom : 0;

    if (scolTot > 0) {
      const hasUnread = scolNonLette > 0;
      html += '<span style="' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'width:18px;height:18px;border-radius:50%;' +
        'background:' + (hasUnread ? '#1a3a5c' : 'transparent') + ';' +
        'color:' + (hasUnread ? 'white' : '#1a3a5c') + ';' +
        'border:2px solid #1a3a5c;' +
        'font-size:10px;font-weight:700;margin-left:4px;flex-shrink:0;">' +
        scolTot + '</span>';
    }
    if (domTot > 0) {
      const hasUnread = domNonLette > 0;
      html += '<span style="' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'width:18px;height:18px;border-radius:50%;' +
        'background:' + (hasUnread ? '#2d6a4f' : 'transparent') + ';' +
        'color:' + (hasUnread ? 'white' : '#2d6a4f') + ';' +
        'border:2px solid #2d6a4f;' +
        'font-size:10px;font-weight:700;margin-left:4px;flex-shrink:0;">' +
        domTot + '</span>';
    }
  } else {
    // Educatore: mostra solo note non lette, sparisce quando lette tutte
    const scolNonLette = (aree === 'scolastico' || aree === 'entrambe') ? cnt.scol : 0;
    const domNonLette = (aree === 'domiciliare' || aree === 'entrambe') ? cnt.dom : 0;

    if (scolNonLette > 0) {
      html += '<span style="' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'width:18px;height:18px;border-radius:50%;' +
        'background:#1a3a5c;color:white;' +
        'font-size:10px;font-weight:700;margin-left:4px;flex-shrink:0;">' +
        scolNonLette + '</span>';
    }
    if (domNonLette > 0) {
      html += '<span style="' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'width:18px;height:18px;border-radius:50%;' +
        'background:#2d6a4f;color:white;' +
        'font-size:10px;font-weight:700;margin-left:4px;flex-shrink:0;">' +
        domNonLette + '</span>';
    }
  }
  return html;
}

function renderListaMinori() {
  const wrap = document.getElementById('diario-lista-minori');
  const cercaVal = (document.getElementById('diario-cerca') || {}).value || '';
  const filtro = diarioFiltroArea;

  let lista = diarioMinori.filter(m => m.attivo !== false);

  // Escludi micronido e doposcuola — avranno un diario separato in futuro
  lista = lista.filter(m => m.aree !== 'micronido' && m.aree !== 'doposcuola');

  if (filtro !== 'tutti') {
    lista = lista.filter(m => {
      if (filtro === 'scolastico') return m.aree === 'scolastico' || m.aree === 'entrambe';
      if (filtro === 'domiciliare') return m.aree === 'domiciliare' || m.aree === 'entrambe';
      return true;
    });
  }

  if (cercaVal.trim()) {
    const q = cercaVal.toLowerCase();
    lista = lista.filter(m => m.nome.toLowerCase().includes(q) || (m.comune || '').toLowerCase().includes(q));
  }

  lista.sort((a, b) => a.nome.localeCompare(b.nome));

  if (!lista.length) {
    wrap.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>Nessun minore trovato.</p></div>';
    return;
  }

  wrap.innerHTML = lista.map(m => {
    const badgeAree = m.aree === 'entrambe'
      ? '<div style="display:flex;align-items:center;gap:2px;"><span class="bdg-area scol">Scolastico</span>' + badgeNoteListe(m.id, 'scolastico') + '</div>' +
        '<div style="display:flex;align-items:center;gap:2px;margin-top:4px;"><span class="bdg-area dom">Domiciliare</span>' + badgeNoteListe(m.id, 'domiciliare') + '</div>'
      : m.aree === 'scolastico'
        ? '<div style="display:flex;align-items:center;gap:2px;"><span class="bdg-area scol">Scolastico</span>' + badgeNoteListe(m.id, 'scolastico') + '</div>'
        : m.aree === 'micronido'
          ? '<span class="bdg-area" style="background:#fde8f5;color:#7b1fa2;">Micronido</span>'
          : m.aree === 'doposcuola'
            ? '<span class="bdg-area" style="background:#fff3e0;color:#c47a2e;">Doposcuola</span>'
            : '<div style="display:flex;align-items:center;gap:2px;"><span class="bdg-area dom">Domiciliare</span>' + badgeNoteListe(m.id, 'domiciliare') + '</div>';

    const refParts = [];
    if (m.educatoreNomeScolastico) refParts.push('🏫 ' + m.educatoreNomeScolastico);
    if (m.educatoreNomeScolastico2) refParts.push('🏫 ' + m.educatoreNomeScolastico2);
    if (m.educatoreNomeExtra) refParts.push('🏠 ' + m.educatoreNomeExtra);
    const refStr = refParts.length ? refParts.join(' · ') : '';

    return `<div class="diario-item" onclick="apriDiarioMinore('${m.id}')">
      <div class="av" style="background:${coloreAvatar(m.nome)}">${iniziali(m.nome)}</div>
      <div class="ii-info">
        <div class="ii-nome">${m.nome}</div>
        <div class="ii-sub">${m.comune || ''}${m.scuola ? ' · ' + m.scuola : ''}</div>
        ${refStr ? `<div class="ii-sub" style="margin-top:2px;color:var(--accent);">${refStr}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        ${badgeAree}
      </div>
    </div>`;
  }).join('');
}

function coloreAvatar(nome) {
  const colori = ['#1a3a5c', '#2d6a4f', '#7b3f00', '#4a1942', '#1b4332', '#3d405b'];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return colori[Math.abs(hash) % colori.length];
}

// ── APERTURA DIARIO MINORE ──

async function apriDiarioMinore(id) {
  diarioMinoreSelezionato = diarioMinori.find(m => m.id === id);
  if (!diarioMinoreSelezionato) return;

  document.getElementById('diario-lista-view').style.display = 'none';
  document.getElementById('diario-dettaglio-view').style.display = 'block';

  const m = diarioMinoreSelezionato;
  document.getElementById('diario-det-nome').textContent = m.nome;

  const badgeAree = m.aree === 'entrambe'
    ? 'Scolastico + Domiciliare'
    : m.aree === 'scolastico' ? 'Scolastico'
    : m.aree === 'micronido' ? 'Micronido'
    : m.aree === 'doposcuola' ? 'Doposcuola'
    : 'Domiciliare';
  document.getElementById('diario-det-sub').textContent = (m.comune || '') + (m.scuola ? ' · ' + m.scuola : '') + ' · ' + badgeAree;

  // Referenti
  const refParts = [];
  if (m.educatoreNomeScolastico) refParts.push('🏫 ' + m.educatoreNomeScolastico);
  if (m.educatoreNomeScolastico2) refParts.push('🏫 ' + m.educatoreNomeScolastico2);
  if (m.educatoreNomeExtra) refParts.push('🏠 ' + m.educatoreNomeExtra);
  document.getElementById('diario-det-ref').textContent = refParts.join('  ');

  await caricaNoteDiario(id);
  await verificaNotificheCollega(id);
}

function tornaDiarioLista() {
  document.getElementById('diario-lista-view').style.display = 'block';
  document.getElementById('diario-dettaglio-view').style.display = 'none';
  diarioMinoreSelezionato = null;
  diarioNoteCorrente = [];
  // Ricarica i conteggi note dopo aver letto
  caricaNoteCount().then(function() { renderListaMinori(); });
}

// ── CARICAMENTO NOTE ──

async function caricaNoteDiario(minoreId) {
  const wrap = document.getElementById('diario-note-lista');
  wrap.innerHTML = '<div class="empty"><p>Caricamento…</p></div>';
  try {
    diarioNoteCorrente = await syncGetNoteDiario(minoreId);
    renderNoteDiario();
    // Segna come lette le note degli altri (non le proprie)
    const nonLette = diarioNoteCorrente.filter(function(n) {
      return n.autoreId !== currentEdu.id &&
        !(n.vistoDA || []).some(function(v) { return v.id === currentEdu.id; });
    });
    if (nonLette.length) {
      const utente = { id: currentEdu.id, nome: currentEdu.nome };
      await Promise.all(nonLette.map(function(n) {
        return col('diario').doc(n.id).update({
          vistoDA: firebase.firestore.FieldValue.arrayUnion(utente)
        });
      }));
      if (typeof aggiornaContatoreBadge === 'function') aggiornaContatoreBadge();
    }
  } catch (err) {
    wrap.innerHTML = '<div class="empty"><p>Errore caricamento note.</p></div>';
  }
}

function renderNoteDiario() {
  const wrap = document.getElementById('diario-note-lista');

  if (!diarioNoteCorrente.length) {
    wrap.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Nessuna nota ancora.<br>Scrivi la prima nota qui sotto.</p></div>';
    return;
  }

  wrap.innerHTML = diarioNoteCorrente.map(n => renderNotaCard(n)).join('');
}

function renderNotaCard(nota) {
  const isUrgente = nota.urgente;
  const hasDomanda = nota.domandaCoord && nota.domandaCoord.trim();
  const ts = nota.timestamp ? new Date(nota.timestamp.seconds * 1000) : new Date();
  const dataStr = ts.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const oraStr = ts.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const commentiHtml = (nota.commenti || []).map(c => {
    const cts = c.timestamp ? new Date(c.timestamp.seconds * 1000) : new Date();
    const cdataStr = cts.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return `<div class="commento-item">
      <div class="commento-autore">${c.autoreNome} · ${cdataStr}</div>
      <div class="commento-testo">${c.testo}</div>
    </div>`;
  }).join('');

  const vistoHtml = (nota.vistoDA || []).length
    ? `<div class="nota-visto">👁 Visto da: ${nota.vistoDA.map(v => v.nome).join(', ')}</div>`
    : '';

  return `<div class="nota-card ${isUrgente ? 'nota-urgente' : ''}" id="nota-${nota.id}">
    <div class="nota-header">
      <div class="nota-autore-wrap">
        <div class="av av-sm" style="background:${coloreAvatar(nota.autoreNome)}">${iniziali(nota.autoreNome)}</div>
        <div>
          <div class="nota-autore">${nota.autoreNome}</div>
          <div class="nota-data">${dataStr} · ${oraStr}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        ${isUrgente ? '<span class="badge-urgente">⚠ Urgente</span>' : ''}
        ${hasDomanda ? '<span class="badge-domanda">❓ Domanda</span>' : ''}
        ${(nota.autoreId === currentEdu.id || currentEdu.ruolo === 'coordinatore_pedagogico' || currentEdu.ruolo === 'coordinatore_area')
          ? `<button onclick="eliminaNota('${nota.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;color:#b52b2b;padding:0 4px;" title="Elimina nota">🗑</button>`
          : ''}
      </div>
    </div>

    ${nota.cosaSucesso ? `<div class="nota-blocco"><div class="nota-blocco-label">Cosa è successo</div><div class="nota-blocco-testo">${nota.cosaSucesso}</div></div>` : ''}
    ${nota.statoEmotivo ? `<div class="nota-blocco"><div class="nota-blocco-label">Stato emotivo e retroazioni</div><div class="nota-blocco-testo">${nota.statoEmotivo}</div></div>` : ''}
    ${nota.contesto ? `<div class="nota-blocco"><div class="nota-blocco-label">Contesto relazionale</div><div class="nota-blocco-testo">${nota.contesto}</div></div>` : ''}
    ${hasDomanda ? `<div class="nota-blocco nota-blocco-domanda"><div class="nota-blocco-label">❓ Domanda ai coordinatori</div><div class="nota-blocco-testo">${nota.domandaCoord}</div></div>` : ''}

    ${vistoHtml}

    ${commentiHtml ? `<div class="commenti-wrap">${commentiHtml}</div>` : ''}

    <button class="bt-commenta" onclick="apriFormCommento('${nota.id}')">+ Aggiungi commento</button>

    <div class="form-commento" id="form-commento-${nota.id}" style="display:none;">
      <textarea id="txt-commento-${nota.id}" placeholder="Scrivi un commento o suggerimento…" maxlength="400" rows="3"></textarea>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="bt bt-sec" style="flex:1;padding:9px;" onclick="chiudiFormCommento('${nota.id}')">Annulla</button>
        <button class="bt bt-pri" style="flex:1;padding:9px;" onclick="salvaCommento('${nota.id}')">Invia</button>
      </div>
    </div>
  </div>`;
}

function apriFormCommento(notaId) {
  document.getElementById('form-commento-' + notaId).style.display = 'block';
  setTimeout(() => document.getElementById('txt-commento-' + notaId).focus(), 100);
}

function chiudiFormCommento(notaId) {
  document.getElementById('form-commento-' + notaId).style.display = 'none';
  document.getElementById('txt-commento-' + notaId).value = '';
}

async function salvaCommento(notaId) {
  const txtEl = document.getElementById('txt-commento-' + notaId);
  if (!txtEl) { toast('Errore: campo commento non trovato'); return; }
  const testo = txtEl.value.trim();
  if (!testo) { toast('Scrivi un commento prima di inviare'); return; }

  try {
    await syncAddCommento(notaId, {
      autoreId: currentEdu.id,
      autoreNome: currentEdu.nome,
      testo
    });
    chiudiFormCommento(notaId);
    // Notifica autore nota + altri commentatori + coordinatori
    try {
      const notaDoc = await col('diario').doc(notaId).get();
      if (notaDoc.exists) {
        const nota = notaDoc.data();
        const daNotificare = new Set();
        if (nota.autoreId && nota.autoreId !== currentEdu.id) daNotificare.add(nota.autoreId + '|' + (nota.autoreNome||''));
        (nota.commenti || []).forEach(function(c) {
          if (c.autoreId && c.autoreId !== currentEdu.id) daNotificare.add(c.autoreId + '|' + (c.autoreNome||''));
        });
        for (const entry of daNotificare) {
          const [destId, destNome] = entry.split('|');
          await syncAddNotifica({ destinatarioId: destId, destinatarioNome: destNome, tipo: 'risposta_nota',
            testo: currentEdu.nome + ' ha risposto a una nota su ' + (nota.minoreNome || ''),
            minoreId: nota.minoreId || '', minoreNome: nota.minoreNome || '', notaId: notaId });
        }
        await notificaCoordinatoriNuovaNota(nota, 'risposta');
      }
    } catch(e) { /* silenzioso */ }
    if (diarioMinoreSelezionato && diarioMinoreSelezionato.id) {
      await caricaNoteDiario(diarioMinoreSelezionato.id);
    }
    toast('Commento aggiunto ✓');
  } catch (err) {
    console.error('Errore salvaCommento:', err);
    toast('Errore: ' + err.message);
  }
}

async function eliminaNota(notaId) {
  if (!confirm('Eliminare questa nota? L\'operazione non è reversibile.')) return;
  try {
    await syncDeleteNota(notaId);
    if (diarioMinoreSelezionato && diarioMinoreSelezionato.id) {
      await caricaNoteDiario(diarioMinoreSelezionato.id);
    }
    toast('Nota eliminata');
  } catch (err) {
    toast('Errore: ' + err.message);
  }
}

// ── DIARIO SERVIZI ──

let diarioServizioSelezionato = null;
let diarioServizioNote = [];

function setDiarioTab(tab) {
  const isMinori = tab === 'minori';
  document.getElementById('diario-tab-minori').style.display = isMinori ? 'block' : 'none';
  document.getElementById('diario-tab-servizi').style.display = isMinori ? 'none' : 'block';
  // stile tab attivo/inattivo
  const tabM = document.getElementById('tab-minori');
  const tabS = document.getElementById('tab-servizi');
  tabM.style.fontWeight = isMinori ? '700' : '600';
  tabM.style.color = isMinori ? 'var(--primary)' : 'var(--muted)';
  tabM.style.borderBottom = isMinori ? '2px solid var(--primary)' : 'none';
  tabS.style.fontWeight = isMinori ? '600' : '700';
  tabS.style.color = isMinori ? 'var(--muted)' : 'var(--primary)';
  tabS.style.borderBottom = isMinori ? 'none' : '2px solid var(--primary)';
  if (!isMinori) renderListaServizi();
}

async function renderListaServizi() {
  const wrap = document.getElementById('diario-lista-servizi');
  wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Caricamento…</p>';
  try {
    const snap = await col('servizi').get();
    const isCoord = currentEdu.ruolo === 'coordinatore_pedagogico';
    let servizi = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filtra per educatore: vede solo i servizi a cui è assegnato (o tutti se coordinatore)
    if (!isCoord) {
      servizi = servizi.filter(s =>
        (s.educatori || []).some(e => e.id === currentEdu.id)
      );
    }

    servizi.sort((a, b) => (a.nome||'').localeCompare(b.nome||''));

    if (!servizi.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);padding:20px 0;">Nessun servizio assegnato.</p>';
      return;
    }

    // Carica conteggi note non lette per ogni servizio
    const noteCountServizi = await caricaNoteCountServizi(servizi.map(s => s.id));

    wrap.innerHTML = servizi.map(s => {
      const tipoLabel = s.tipo === 'micronido' ? '🧸'
        : s.tipo === 'doposcuola' ? '🏫'
        : s.tipo === 'centro_estivo' ? '☀️' : '📋';
      const cnt = noteCountServizi[s.id] || { nonLette: 0, tot: 0 };
      const badgeHtml = cnt.nonLette > 0
        ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#c47a2e;color:white;font-size:10px;font-weight:700;margin-left:6px;">' + cnt.nonLette + '</span>'
        : isCoord && cnt.tot > 0
          ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:2px solid #c47a2e;color:#c47a2e;font-size:10px;font-weight:700;margin-left:6px;">' + cnt.tot + '</span>'
          : '';

      return `<div class="diario-item" onclick="apriDiarioServizio('${s.id}')">
        <div class="av" style="background:#c47a2e;font-size:18px;display:flex;align-items:center;justify-content:center;">${tipoLabel}</div>
        <div class="ii-info">
          <div class="ii-nome">${s.nome}${badgeHtml}</div>
          <div class="ii-sub">${s.comune || ''}${s.sede ? ' · ' + s.sede : ''}</div>
        </div>
      </div>`;
    }).join('');

    // Aggiorna badge tab
    const totNonLette = Object.values(noteCountServizi).reduce((s, c) => s + c.nonLette, 0);
    const badgeTab = document.getElementById('badge-tab-servizi');
    if (totNonLette > 0) {
      badgeTab.style.display = 'inline';
      badgeTab.textContent = totNonLette;
    } else {
      badgeTab.style.display = 'none';
    }
  } catch(e) {
    wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Errore caricamento servizi.</p>';
  }
}

async function caricaNoteCountServizi(servizioIds) {
  const result = {};
  servizioIds.forEach(id => { result[id] = { nonLette: 0, tot: 0 }; });
  try {
    const snap = await col('diario_servizi').get();
    snap.docs.forEach(d => {
      const nota = d.data();
      if (!nota.servizioId || !result[nota.servizioId]) return;
      result[nota.servizioId].tot++;
      const letta = (nota.vistoDA || []).some(v => v.id === currentEdu.id);
      if (!letta) result[nota.servizioId].nonLette++;
    });
  } catch(e) { /* ignora */ }
  return result;
}

async function apriDiarioServizio(id) {
  const snap = await col('servizi').doc(id).get();
  if (!snap.exists) return;
  diarioServizioSelezionato = { id: snap.id, ...snap.data() };

  document.getElementById('ds-titolo').textContent = diarioServizioSelezionato.nome;
  const tipoLabel = diarioServizioSelezionato.tipo === 'micronido' ? 'Micronido'
    : diarioServizioSelezionato.tipo === 'doposcuola' ? 'Doposcuola'
    : diarioServizioSelezionato.tipo === 'centro_estivo' ? 'Centro Estivo' : 'Servizio';
  document.getElementById('ds-sub').textContent = tipoLabel + (diarioServizioSelezionato.comune ? ' · ' + diarioServizioSelezionato.comune : '');
  document.getElementById('ds-testo').value = '';
  document.getElementById('ds-urgente').checked = false;
  document.getElementById('ds-contatore').textContent = '0/300';

  document.getElementById('diario-servizio-view').style.display = 'block';
  await caricaNoteServizio(id);
}

function tornaListaServizi() {
  document.getElementById('diario-servizio-view').style.display = 'none';
  diarioServizioSelezionato = null;
  renderListaServizi();
}

function aggiornaContatore() {
  const len = (document.getElementById('ds-testo').value || '').length;
  document.getElementById('ds-contatore').textContent = len + '/300';
}

async function caricaNoteServizio(servizioId) {
  const wrap = document.getElementById('ds-note-lista');
  wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Caricamento…</p>';
  try {
    const snap = await col('diario_servizi')
      .where('servizioId', '==', servizioId)
      .get();
    diarioServizioNote = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.timestamp ? a.timestamp.seconds : 0;
        const tb = b.timestamp ? b.timestamp.seconds : 0;
        return tb - ta;
      });

    // Segna come lette
    for (const nota of diarioServizioNote) {
      const giaLetta = (nota.vistoDA || []).some(v => v.id === currentEdu.id);
      if (!giaLetta) {
        await col('diario_servizi').doc(nota.id).update({
          vistoDA: firebase.firestore.FieldValue.arrayUnion({ id: currentEdu.id, nome: currentEdu.nome })
        });
      }
    }

    renderNoteServizio();
  } catch(e) {
    wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Errore caricamento.</p>';
  }
}

function renderNoteServizio() {
  const wrap = document.getElementById('ds-note-lista');
  if (!diarioServizioNote.length) {
    wrap.innerHTML = '<div class="empty"><p>Nessuna nota ancora.</p></div>';
    return;
  }
  wrap.innerHTML = diarioServizioNote.map(nota => {
    const data = nota.timestamp ? new Date(nota.timestamp.seconds * 1000).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
    const urgente = nota.urgente ? '<span style="background:#fde8e8;color:#8C0E0E;font-size:11px;padding:2px 6px;border-radius:4px;margin-left:6px;">⚠ Urgente</span>' : '';
    const commenti = (nota.commenti || []).map(c => {
      const cData = c.timestamp ? new Date(c.timestamp.seconds * 1000).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
      return `<div style="margin-top:6px;padding:8px;background:#f5f5f5;border-radius:6px;font-size:12px;">
        <strong>${c.autoreNome}</strong> · ${cData}<br>${c.testo}
      </div>`;
    }).join('');

    const formCommento = `<div id="ds-form-comm-${nota.id}" style="display:none;margin-top:8px;">
      <textarea id="ds-comm-txt-${nota.id}" rows="2" maxlength="300"
        style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit;resize:none;"
        placeholder="Scrivi un commento…"></textarea>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button onclick="chiudiCommServizio('${nota.id}')" style="flex:1;padding:7px;border:1px solid var(--border);border-radius:6px;background:white;font-size:12px;cursor:pointer;">Annulla</button>
        <button onclick="salvaCommServizio('${nota.id}')" style="flex:2;padding:7px;border:none;border-radius:6px;background:var(--primary);color:white;font-size:12px;font-weight:700;cursor:pointer;">Invia</button>
      </div>
    </div>`;

    return `<div class="nota-card" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div style="font-size:12px;font-weight:700;">${nota.autoreNome}${urgente}</div>
        <div style="font-size:11px;color:var(--muted);">${data}</div>
      </div>
      <div style="font-size:14px;line-height:1.5;">${nota.testo}</div>
      ${commenti}
      <button onclick="apriCommServizio('${nota.id}')" style="margin-top:8px;background:none;border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--muted);">+ Commenta</button>
      ${formCommento}
      ${currentEdu.ruolo === 'coordinatore_pedagogico' || nota.autoreId === currentEdu.id
        ? `<button onclick="eliminaNotaServizio('${nota.id}')" style="margin-top:4px;margin-left:6px;background:none;border:none;font-size:14px;cursor:pointer;color:#b52b2b;">🗑</button>`
        : ''}
    </div>`;
  }).join('');
}

async function salvaNotaServizio() {
  if (!diarioServizioSelezionato) return;
  const testo = document.getElementById('ds-testo').value.trim();
  if (!testo) { toast('Scrivi qualcosa prima di salvare'); return; }
  const urgente = document.getElementById('ds-urgente').checked;

  try {
    await col('diario_servizi').add({
      servizioId: diarioServizioSelezionato.id,
      servizioNome: diarioServizioSelezionato.nome,
      autoreId: currentEdu.id,
      autoreNome: currentEdu.nome,
      testo,
      urgente,
      commenti: [],
      vistoDA: [{ id: currentEdu.id, nome: currentEdu.nome }],
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('ds-testo').value = '';
    document.getElementById('ds-urgente').checked = false;
    document.getElementById('ds-contatore').textContent = '0/300';
    await caricaNoteServizio(diarioServizioSelezionato.id);
    toast('Nota salvata ✓');
  } catch(e) {
    toast('Errore: ' + e.message);
  }
}

function apriCommServizio(notaId) {
  document.getElementById('ds-form-comm-' + notaId).style.display = 'block';
  document.getElementById('ds-comm-txt-' + notaId).focus();
}

function chiudiCommServizio(notaId) {
  document.getElementById('ds-form-comm-' + notaId).style.display = 'none';
}

async function salvaCommServizio(notaId) {
  const testo = document.getElementById('ds-comm-txt-' + notaId).value.trim();
  if (!testo) return;
  const commento = {
    autoreId: currentEdu.id,
    autoreNome: currentEdu.nome,
    testo,
    timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
  };
  try {
    await col('diario_servizi').doc(notaId).update({
      commenti: firebase.firestore.FieldValue.arrayUnion(commento)
    });
    await caricaNoteServizio(diarioServizioSelezionato.id);
    toast('Commento aggiunto ✓');
  } catch(e) {
    toast('Errore: ' + e.message);
  }
}

async function eliminaNotaServizio(notaId) {
  if (!confirm('Eliminare questa nota?')) return;
  try {
    await col('diario_servizi').doc(notaId).delete();
    await caricaNoteServizio(diarioServizioSelezionato.id);
    toast('Nota eliminata');
  } catch(e) {
    toast('Errore: ' + e.message);
  }
}

function apriFormNuovaNota() {
  document.getElementById('diario-dettaglio-view').style.display = 'none';
  document.getElementById('diario-form-view').style.display = 'block';

  // Reset campi
  document.getElementById('fn-cosa').value = '';
  document.getElementById('fn-stato').value = '';
  document.getElementById('fn-contesto').value = '';
  document.getElementById('fn-domanda').value = '';
  document.getElementById('fn-urgente').checked = false;

  // Reset contatori
  aggiornaContatore('fn-cosa', 'cnt-cosa', 300);
  aggiornaContatore('fn-stato', 'cnt-stato', 200);
  aggiornaContatore('fn-contesto', 'cnt-contesto', 200);
  aggiornaContatore('fn-domanda', 'cnt-domanda', 200);
}

function tornaDettTaglio() {
  document.getElementById('diario-form-view').style.display = 'none';
  document.getElementById('diario-dettaglio-view').style.display = 'block';
}

function aggiornaContatore(fieldId, counterId, max) {
  const field = document.getElementById(fieldId);
  const counter = document.getElementById(counterId);
  if (!field || !counter) return;
  const len = field.value.length;
  counter.textContent = len + '/' + max;
  counter.style.color = len > max * 0.9 ? 'var(--danger)' : 'var(--muted)';
}

// ── NOTIFICHE DIARIO ──

async function notificaCoordinatoriNuovaNota(nota, tipo) {
  try {
    const snapEdu = await col('educatori').get();
    const coordinatori = snapEdu.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.ruolo === 'coordinatore_pedagogico' && e.id !== currentEdu.id);
    for (const coord of coordinatori) {
      await syncAddNotifica({
        destinatarioId: coord.id,
        destinatarioNome: coord.nome,
        tipo: tipo === 'risposta' ? 'risposta_nota' : 'nuova_nota',
        testo: tipo === 'risposta'
          ? currentEdu.nome + ' ha commentato una nota su ' + (nota.minoreNome || nota.minore || '')
          : currentEdu.nome + ' ha scritto una nuova nota su ' + (nota.minoreNome || nota.minore || ''),
        minoreId: nota.minoreId || '',
        minoreNome: nota.minoreNome || nota.minore || '',
        notaId: nota.id || ''
      });
    }
  } catch(e) { /* silenzioso */ }
}

async function mostraPopupNotifiche() {
  try {
    const notifiche = await syncGetNotificheNonLette(currentEdu.id);
    if (!notifiche.length) return;
    const testi = notifiche.slice(0, 5).map(n => '• ' + n.testo).join('\n');
    const altreN = notifiche.length > 5 ? '\n+ altre ' + (notifiche.length - 5) + ' notifiche' : '';
    const popup = document.createElement('div');
    popup.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px;';
    popup.innerHTML = '<div style="background:white;border-radius:14px;padding:22px;max-width:340px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.2);">' +
      '<div style="font-size:22px;margin-bottom:8px;">🔔</div>' +
      '<div style="font-size:16px;font-weight:700;color:#1a3a5c;margin-bottom:8px;">Nuove notifiche dal diario</div>' +
      '<div style="font-size:13px;color:#444;white-space:pre-line;line-height:1.6;margin-bottom:16px;">' + testi + altreN + '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button id="popup-ignora" style="flex:1;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f0f4f8;font-size:13px;cursor:pointer;">Ignora</button>' +
        '<button id="popup-diario" style="flex:2;padding:10px;border:none;border-radius:8px;background:#1a3a5c;color:white;font-size:13px;font-weight:700;cursor:pointer;">Vai al Diario</button>' +
      '</div></div>';
    document.body.appendChild(popup);
    document.getElementById('popup-ignora').onclick = async function() {
      await syncSegnaNotificheAllLette(currentEdu.id);
      document.body.removeChild(popup);
      aggiornaContatoreBadge();
    };
    document.getElementById('popup-diario').onclick = async function() {
      await syncSegnaNotificheAllLette(currentEdu.id);
      document.body.removeChild(popup);
      aggiornaContatoreBadge();
      const navBtn = document.querySelector('.nb[data-page="diario"]');
      if (navBtn) navBtn.click();
    };
  } catch(e) { /* silenzioso */ }
}

// ── REVERSE GEOCODING GPS MICRONIDO ──

async function reverseGeocodeCoord(coordStr) {
  if (!coordStr) return coordStr;
  const parts = coordStr.split(',');
  if (parts.length < 2) return coordStr;
  const lat = parts[0].trim();
  const lon = parts[1].trim();
  try {
    const url = 'https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json&addressdetails=1&accept-language=it';
    const res = await fetch(url, { headers: { 'User-Agent': 'FiloAriannaPresenze/1.0' } });
    if (!res.ok) return coordStr;
    const d = await res.json();
    if (d && d.address) {
      const a = d.address;
      const nome = (d.name || a.amenity || a.building || a.school || '').trim();
      const via = (a.road || a.pedestrian || '').trim();
      const civico = (a.house_number || '').trim();
      const citta = (a.city || a.town || a.village || '').trim();
      let r = '';
      if (nome) r += nome;
      if (via) r += (r ? ', ' : '') + via + (civico ? ' ' + civico : '');
      if (citta) r += (r ? ', ' : '') + citta;
      return r || coordStr;
    }
  } catch(e) { }
  return coordStr;
}

async function mostraGPSMicronido() {
  let cardGps = document.getElementById('card-gps-micronido');
  if (!cardGps) {
    const adminLista = document.getElementById('admin-lista-view');
    cardGps = document.createElement('div');
    cardGps.id = 'card-gps-micronido';
    cardGps.className = 'card';
    adminLista.appendChild(cardGps);
  }
  cardGps.innerHTML = '<div class="card-hd">📍 Timbrature GPS operatori micronido</div>' +
    '<p style="font-size:12px;color:var(--muted);margin-bottom:10px;">Posizioni del mese corrente — risoluzione indirizzo in corso…</p>' +
    '<div id="gps-lista">Caricamento…</div>';

  try {
    const snapEdu = await col('educatori').get();
    const operatori = snapEdu.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.area === 'micronido');
    if (!operatori.length) {
      document.getElementById('gps-lista').innerHTML = '<p style="font-size:13px;color:var(--muted);">Nessun operatore micronido.</p>';
      return;
    }
    const mese = meseISO();
    let righe = '';
    for (const op of operatori) {
      const snap = await col('timbrature').where('educatoreId', '==', op.id).where('mese', '==', mese).get();
      const timb = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.gpsEntrata)
        .sort((a, b) => b.data.localeCompare(a.data));
      if (!timb.length) continue;
      // Risolvi indirizzi per ogni timbratura
      const timbConIndirizzo = await Promise.all(timb.map(async function(t) {
        const indirizzoEntrata = await reverseGeocodeCoord(t.gpsEntrata);
        const indirizzoUscita = t.gpsUscita ? await reverseGeocodeCoord(t.gpsUscita) : null;
        return { ...t, indirizzoEntrata, indirizzoUscita };
      }));
      righe += '<div style="margin-bottom:12px;">' +
        '<div style="font-size:13px;font-weight:700;color:#1a3a5c;margin-bottom:6px;">' + op.nome + '</div>' +
        timbConIndirizzo.map(t => {
          const mapUrl = 'https://maps.google.com/?q=' + t.gpsEntrata;
          const mapUrlU = t.gpsUscita ? 'https://maps.google.com/?q=' + t.gpsUscita : '';
          return '<div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);">' +
            '<span style="color:#6b7280;font-size:11px;">' + formatData(t.data) + '</span><br>' +
            '📍 <a href="' + mapUrl + '" target="_blank" style="color:#1a3a5c;">' + t.indirizzoEntrata + '</a> <span style="color:#6b7280;font-size:10px;">(entrata ' + (t.entrata||'') + ')</span>' +
            (t.indirizzoUscita ? '<br>📍 <a href="' + mapUrlU + '" target="_blank" style="color:#2d6a4f;">' + t.indirizzoUscita + '</a> <span style="color:#6b7280;font-size:10px;">(uscita ' + (t.uscita||'') + ')</span>' : '') +
          '</div>';
        }).join('') + '</div>';
    }
    document.getElementById('gps-lista').innerHTML = righe || '<p style="font-size:13px;color:var(--muted);">Nessuna timbratura GPS disponibile.</p>';
  } catch(e) {
    document.getElementById('gps-lista').innerHTML = '<p style="font-size:13px;color:var(--muted);">Errore: ' + e.message + '</p>';
  }
}

async function salvaNuovaNota() {
  const cosa = document.getElementById('fn-cosa').value.trim();
  const stato = document.getElementById('fn-stato').value.trim();
  const contesto = document.getElementById('fn-contesto').value.trim();
  const domanda = document.getElementById('fn-domanda').value.trim();
  const urgente = document.getElementById('fn-urgente').checked;

  if (!cosa && !stato) {
    toast('Compila almeno il primo o il secondo campo');
    return;
  }

  const nota = {
    minoreId: diarioMinoreSelezionato.id,
    minoreNome: diarioMinoreSelezionato.nome,
    autoreId: currentEdu.id,
    autoreNome: currentEdu.nome,
    autoreArea: currentEdu.area || '',
    cosaSucesso: cosa,
    statoEmotivo: stato,
    contesto: contesto,
    domandaCoord: domanda,
    urgente: urgente,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    commenti: [],
    vistoDA: [{ id: currentEdu.id, nome: currentEdu.nome }]
  };

  try {
    const notaRef = await syncAddNotaDiario(nota);
    toast('Nota salvata ✓');
    tornaDettTaglio();
    await caricaNoteDiario(diarioMinoreSelezionato.id);
    // Notifica coordinatori di ogni nuova nota
    await notificaCoordinatoriNuovaNota({ ...nota, id: notaRef.id }, 'nuova');
    if (urgente || domanda) {
      await aggiornaContatoreBadge();
    }

    // Se urgente: notifica anche il collega educatore sul caso
    if (urgente) {
      await notificaCollegaUrgente(notaRef.id);
    }
  } catch (err) {
    toast('Errore salvataggio: ' + err.message);
  }
}

// ── NOTIFICA COLLEGA PER URGENZE ──

async function notificaCollegaUrgente(notaId) {
  const m = diarioMinoreSelezionato;
  if (!m) return;

  // Raccoglie tutti i potenziali colleghi (escluso chi ha scritto la nota)
  const colleghi = [];

  // Educatore scolastico 1
  if (m.educatoreIdScolastico && m.educatoreIdScolastico !== currentEdu.id) {
    colleghi.push({ id: m.educatoreIdScolastico, nome: m.educatoreNomeScolastico });
  }
  // Educatore scolastico 2
  if (m.educatoreIdScolastico2 && m.educatoreIdScolastico2 !== currentEdu.id) {
    colleghi.push({ id: m.educatoreIdScolastico2, nome: m.educatoreNomeScolastico2 });
  }
  // Educatore domiciliare
  if (m.educatoreIdExtra && m.educatoreIdExtra !== currentEdu.id) {
    colleghi.push({ id: m.educatoreIdExtra, nome: m.educatoreNomeExtra });
  }

  if (!colleghi.length) return;

  try {
    for (const collega of colleghi) {
      await syncAddNotificaUrgenzaCollega({
        destinatarioId: collega.id,
        destinatarioNome: collega.nome,
        notaId: notaId,
        minoreId: m.id,
        minoreNome: m.nome,
        autoreNome: currentEdu.nome,
        letto: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (e) { /* silenzioso — non blocca il salvataggio della nota */ }
}

// ── NOTIFICHE URGENZE COLLEGA (fallback) ──

async function verificaNotificheCollega(minoreId) {
  try {
    const notifiche = await syncGetNotificheCollega(currentEdu.id, minoreId);
    const nonLette = notifiche.filter(n => !n.letto);
    const wrap = document.getElementById('diario-notifiche-collega');
    if (!wrap) return;

    if (!nonLette.length) {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'block';
    wrap.innerHTML = nonLette.map(n => {
      const ts = n.timestamp ? new Date(n.timestamp.seconds * 1000) : new Date();
      const dataStr = ts.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const oraStr = ts.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      return `<div class="notifica-collega-item">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:13px;font-weight:700;color:#991b1b;">⚠ Urgenza segnalata da ${n.autoreNome}</span>
          <span style="font-size:11px;color:var(--muted);">${dataStr} ${oraStr}</span>
        </div>
        <div style="font-size:12px;color:var(--muted);">Il tuo collega ha segnalato una situazione urgente su ${n.minoreNome}. Leggi la nota evidenziata qui sotto.</div>
        <button onclick="segnaNotificaCollegaLetta('${n.id}','${minoreId}')" style="margin-top:8px;background:none;border:1px solid #991b1b;border-radius:6px;padding:4px 12px;font-size:11px;color:#991b1b;cursor:pointer;">✓ Ho letto</button>
      </div>`;
    }).join('');
  } catch (e) { /* silenzioso */ }
}

async function segnaNotificaCollegaLetta(notificaId, minoreId) {
  try {
    await syncSegnaNotificaCollegaLetta(notificaId);
    await verificaNotificheCollega(minoreId);
    toast('Segnato come letto ✓');
  } catch (e) { /* silenzioso */ }
}



async function initBacheca() {
  const wrap = document.getElementById('bacheca-lista');
  wrap.innerHTML = '<div class="empty"><p>Caricamento…</p></div>';

  try {
    const items = await syncGetUrgenze();
    if (!items.length) {
      wrap.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p>Nessuna urgenza in attesa.<br>Tutto sotto controllo ✓</p></div>';
      return;
    }
    wrap.innerHTML = items.map(n => renderBachecaItem(n)).join('');
  } catch (err) {
    wrap.innerHTML = '<div class="empty"><p>Errore caricamento.</p></div>';
  }
}

function renderBachecaItem(nota) {
  const ts = nota.timestamp ? new Date(nota.timestamp.seconds * 1000) : new Date();
  const dataStr = ts.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const oraStr = ts.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const giàVisto = (nota.vistoDA || []).some(v => v.id === currentEdu.id);
  const altriVisti = (nota.vistoDA || []).filter(v => v.id !== currentEdu.id);

  return `<div class="bacheca-item ${nota.urgente ? 'bach-urgente' : 'bach-domanda'}" onclick="apriDaBacheca('${nota.id}','${nota.minoreId}')">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
      <div style="font-weight:700;font-size:15px;">${nota.minoreNome}</div>
      <span class="${nota.urgente ? 'badge-urgente' : 'badge-domanda'}">${nota.urgente ? '⚠ Urgente' : '❓ Domanda'}</span>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${nota.autoreNome} · ${dataStr} ${oraStr}</div>
    ${nota.cosaSucesso ? `<div style="font-size:13px;color:var(--text);margin-bottom:4px;">${nota.cosaSucesso.slice(0, 80)}${nota.cosaSucesso.length > 80 ? '…' : ''}</div>` : ''}
    ${nota.domandaCoord ? `<div style="font-size:13px;color:#7b3f00;font-style:italic;">"${nota.domandaCoord.slice(0, 80)}${nota.domandaCoord.length > 80 ? '…' : ''}"</div>` : ''}
    <div style="margin-top:8px;font-size:11px;color:var(--muted);">
      ${giàVisto ? '✓ Già vista da te' : '<span style="color:var(--accent);font-weight:600;">● Non ancora letta</span>'}
      ${altriVisti.length ? ' · Visto anche da: ' + altriVisti.map(v => v.nome.split(' ')[0]).join(', ') : ''}
    </div>
  </div>`;
}

async function apriDaBacheca(notaId, minoreId) {
  // Segna come visto
  try {
    await syncSegnaVisto(notaId, { id: currentEdu.id, nome: currentEdu.nome });
  } catch (e) { /* non blocca */ }

  // Naviga al diario del minore
  await caricaMinoriDiario();
  const minore = diarioMinori.find(m => m.id === minoreId);
  if (minore) {
    navTo('diario', document.querySelector('.nb[data-page="diario"]'));
    await apriDiarioMinore(minoreId);
    await aggiornaContatoreBadge();
  }
}

async function aggiornaContatoreBadge() {
  try {
    let totNonLette = 0;
    const snapDiario = await col('diario').get();
    snapDiario.docs.forEach(function(d) {
      const nota = d.data();
      if (nota.autoreId === currentEdu.id) return;
      const giaLetta = (nota.vistoDA || []).some(v => v.id === currentEdu.id);
      if (!giaLetta) totNonLette++;
    });
    const snapServizi = await col('diario_servizi').get().catch(() => ({ docs: [] }));
    snapServizi.docs.forEach(function(d) {
      const nota = d.data();
      if (nota.autoreId === currentEdu.id) return;
      const giaLetta = (nota.vistoDA || []).some(v => v.id === currentEdu.id);
      if (!giaLetta) totNonLette++;
    });
    const badge = document.getElementById('badge-urgenze');
    if (badge) {
      badge.textContent = totNonLette || '';
      badge.style.display = totNonLette ? 'flex' : 'none';
    }
  } catch (e) { /* silenzioso */ }
}

// ── SINCRONIZZAZIONE MINORI DA TIMBRATURE ──

async function sincronizzaDaTimbrature() {
  const btn = document.getElementById('btn-sincronizza');
  const risultatoWrap = document.getElementById('sync-risultato');
  btn.disabled = true;
  btn.textContent = 'Sincronizzazione in corso…';
  risultatoWrap.style.display = 'none';

  try {
    // Carica tutti gli interventi e i minori già presenti
    const [interventi, minoriEsistenti] = await Promise.all([
      syncGetTuttiInterventi(),
      syncGetMinori()
    ]);

    // Estrai nomi unici dagli interventi, normalizzati
    const nomiEsistenti = new Set(minoriEsistenti.map(m => m.nome.trim().toLowerCase()));

    // Trova i nuovi: non ancora presenti nell'anagrafica
    const nuoviMap = {};
    interventi.forEach(i => {
      const nome = (i.minore || '').trim();
      if (!nome) return;
      const key = nome.toLowerCase();
      if (nomiEsistenti.has(key)) return; // già presente, salta
      if (!nuoviMap[key]) {
        nuoviMap[key] = {
          nome: nome,
          comune: i.comune || '',
          scuola: i.scuola && i.scuola.toLowerCase() !== 'domiciliare' ? i.scuola : '',
          aree: i.scuola && i.scuola.toLowerCase() === 'domiciliare' ? 'domiciliare' : 'scolastico',
          educatoreIdScolastico: '',
          educatoreNomeScolastico: '',
          educatoreIdExtra: '',
          educatoreNomeExtra: '',
          attivo: true
        };
      }
    });

    const nuovi = Object.values(nuoviMap);

    if (!nuovi.length) {
      risultatoWrap.style.display = 'block';
      risultatoWrap.innerHTML = `<div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:12px;font-size:13px;color:#065f46;">
        ✓ Tutti i minori sono già nell'anagrafica. Nessun nuovo inserimento necessario.
      </div>`;
      btn.disabled = false;
      btn.textContent = '↻ Sincronizza da timbrature';
      return;
    }

    // Importa i nuovi
    for (const m of nuovi) {
      await syncAddMinore(m);
    }

    await caricaMinoriDiario();
    renderAdminLista();

    risultatoWrap.style.display = 'block';
    risultatoWrap.innerHTML = `
      <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:12px;font-size:13px;color:#065f46;margin-bottom:8px;">
        ✓ Importati ${nuovi.length} nuov${nuovi.length === 1 ? 'o minore' : 'i minori'}:
      </div>
      ${nuovi.map(m => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <div>
            <strong>${m.nome}</strong>
            <span style="font-size:11px;color:var(--muted);margin-left:8px;">${m.comune || '—'} · ${m.aree}</span>
          </div>
          <span style="font-size:11px;color:var(--accent);">da completare</span>
        </div>`).join('')}
      <p style="font-size:12px;color:var(--muted);margin-top:10px;">Clicca "Modifica" su ciascun minore per completare comune, scuola, area e educatori referenti.</p>`;

    toast(`${nuovi.length} minori importati ✓`);
  } catch (err) {
    risultatoWrap.style.display = 'block';
    risultatoWrap.innerHTML = `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:12px;font-size:13px;color:#991b1b;">
      Errore durante la sincronizzazione: ${err.message}
    </div>`;
  }

  btn.disabled = false;
  btn.textContent = '↻ Sincronizza da timbrature';
}



async function initAdmin() {
  const ruolo = currentEdu.ruolo || '';
  const isCoordPed = ruolo === 'coordinatore_pedagogico';
  const isCoordArea = ruolo === 'coordinatore_area';

  if (isCoordPed) {
    // Coordinatore pedagogico: accesso completo
    await caricaMinoriDiario();
    renderAdminLista();
    await renderServiziLista();
  } else if (isCoordArea) {
    // Coordinatore area: solo lettura, filtrato per area
    await initAdminSolaLettura();
  }
}

async function initAdminSolaLettura() {
  const area = currentEdu.area || '';
  await caricaMinoriDiario();

  // Nascondi tutti i tasti di modifica
  const btns = document.querySelectorAll('#admin-lista-view .bt');
  btns.forEach(b => b.style.display = 'none');

  // Filtra e mostra minori per area (sola lettura)
  const wrap = document.getElementById('admin-minori-lista');
  let lista = [...diarioMinori].filter(m => m.attivo !== false);

  if (area === 'scolastico') {
    lista = lista.filter(m => m.aree === 'scolastico' || m.aree === 'entrambe');
  } else if (area === 'domiciliare') {
    lista = lista.filter(m => m.aree === 'domiciliare' || m.aree === 'entrambe');
  } else if (area === 'micronido') {
    lista = []; // Bonariva vede solo i servizi micronido, non i minori
  }

  lista.sort((a, b) => a.nome.localeCompare(b.nome));

  if (area !== 'micronido') {
    if (!lista.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Nessun minore nella tua area.</p>';
    } else {
      wrap.innerHTML = lista.map(m => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:14px;font-weight:600;">${m.nome}</div>
          <div style="font-size:11px;color:var(--muted);">${m.comune || ''} · ${m.aree || ''}</div>
          <div style="font-size:11px;color:var(--accent);margin-top:2px;">
            ${m.educatoreNomeScolastico ? '🏫 ' + m.educatoreNomeScolastico : ''}
            ${m.educatoreNomeScolastico2 ? ' · 🏫 ' + m.educatoreNomeScolastico2 : ''}
            ${m.educatoreNomeExtra ? ' · 🏠 ' + m.educatoreNomeExtra : ''}
          </div>
        </div>`).join('');
    }
  } else {
    wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Sezione non applicabile alla tua area.</p>';
  }

  // Mostra servizi filtrati per area (sola lettura, nessun tasto)
  const wrapServ = document.getElementById('admin-servizi-lista');
  try {
    const snap = await col('servizi').get();
    let servizi = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Ogni coordinatore area vede solo i servizi della sua area
    if (area === 'micronido') {
      servizi = servizi.filter(s => s.tipo === 'micronido');
    } else if (area === 'domiciliare') {
      servizi = servizi.filter(s => s.tipo === 'doposcuola' || s.tipo === 'centro_estivo' || s.tipo === 'altro');
    } else if (area === 'scolastico') {
      servizi = []; // Dal Lago vede solo i minori scolastici
    }

    servizi.sort((a, b) => (a.nome||'').localeCompare(b.nome||''));

    if (!servizi.length && area !== 'micronido') {
      wrapServ.innerHTML = '<p style="font-size:13px;color:var(--muted);">Nessun servizio nella tua area.</p>';
    } else if (!servizi.length && area === 'micronido') {
      wrapServ.innerHTML = '<p style="font-size:13px;color:var(--muted);">Nessun servizio micronido configurato.</p>';
    } else {
      wrapServ.innerHTML = servizi.map(s => {
        const educatori = (s.educatori || []).map(e => e.nome).join(', ') || '—';
        const tipoLabel = s.tipo === 'micronido' ? '🧸 Micronido'
          : s.tipo === 'doposcuola' ? '🏫 Doposcuola'
          : s.tipo === 'centro_estivo' ? '☀️ Centro Estivo'
          : '📋 ' + (s.tipo || '');
        return `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:14px;font-weight:600;">${s.nome}</div>
          <div style="font-size:11px;color:var(--muted);">${tipoLabel}${s.comune ? ' · ' + s.comune : ''}</div>
          <div style="font-size:11px;color:var(--accent);margin-top:2px;">👤 ${educatori}</div>
        </div>`;
      }).join('');
    }
  } catch(e) {
    wrapServ.innerHTML = '<p style="font-size:13px;color:var(--muted);">Errore caricamento servizi.</p>';
  }
  if (area === 'micronido') {
    await mostraGPSMicronido();
    await mostraRichiesteMicronido();
  }
}



async function mostraRichiesteMicronido() {
  // Crea o aggiorna la card richieste nell'Admin
  let card = document.getElementById('card-richieste-micronido');
  if (!card) {
    const adminLista = document.getElementById('admin-lista-view');
    card = document.createElement('div');
    card.id = 'card-richieste-micronido';
    card.className = 'card';
    adminLista.appendChild(card);
  }

  card.innerHTML = '<div class="card-hd" style="display:flex;justify-content:space-between;align-items:center;">' +
    '<span>📋 Richieste operatori micronido</span>' +
    '<button onclick="scaricaCalendarioMicronido()" style="background:#1a7040;border:none;border-radius:6px;padding:5px 10px;font-size:11px;color:white;cursor:pointer;">↓ Calendario</button>' +
    '</div>' +
    '<div id="richieste-micronido-lista">Caricamento…</div>';

  try {
    // Trova gli educatori del micronido
    const snapEdu = await col('educatori').get();
    const operatori = snapEdu.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.area === 'micronido');
    const idOperatori = new Set(operatori.map(e => e.id));

    // Carica tutte le richieste
    const snapRich = await col('richieste_assenza').get();
    const richieste = snapRich.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => idOperatori.has(r.educatoreId))
      .sort((a, b) => (b.creatoAt?.seconds||0) - (a.creatoAt?.seconds||0));

    const wrap = document.getElementById('richieste-micronido-lista');
    if (!richieste.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Nessuna richiesta.</p>';
      return;
    }

    const statoStyle = { attesa:'background:#fff3e0;color:#c47a2e', approvata:'background:#d1fae5;color:#065f46', rifiutata:'background:#fde8e8;color:#8C0E0E' };
    const statoLabel = { attesa:'⏳ In attesa', approvata:'✓ Approvata', rifiutata:'✗ Rifiutata' };

    wrap.innerHTML = richieste.map(r => {
      const periodo = r.dal === r.al ? formatData(r.dal) : formatData(r.dal) + ' → ' + formatData(r.al);
      const orario = r.dalle && r.alle ? ' · ' + r.dalle + '-' + r.alle : '';
      const noteCoord = r.noteCoordinatore ? '<div style="font-size:11px;color:#6b7280;margin-top:2px;">Nota: ' + r.noteCoordinatore + '</div>' : '';
      const azioni = r.stato === 'attesa'
        ? '<div style="display:flex;gap:6px;margin-top:8px;">' +
            '<input type="text" id="esito-note-' + r.id + '" placeholder="Nota al richiedente…" style="flex:1;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:12px;">' +
            '<button onclick="gestisciRichiestaMicronido(\'' + r.id + '\',\'rifiutata\')" style="background:#8C0E0E;border:none;border-radius:6px;padding:6px 10px;color:white;font-size:12px;cursor:pointer;">✗</button>' +
            '<button onclick="gestisciRichiestaMicronido(\'' + r.id + '\',\'approvata\')" style="background:#1a7040;border:none;border-radius:6px;padding:6px 10px;color:white;font-size:12px;font-weight:700;cursor:pointer;">✓</button>' +
          '</div>'
        : '';
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border);">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
          '<div>' +
            '<div style="font-size:13px;font-weight:600;">' + r.educatoreNome + ' · ' + (r.tipoLabel||r.tipo) + '</div>' +
            '<div style="font-size:11px;color:var(--muted);">' + periodo + orario + (r.note ? ' · ' + r.note : '') + '</div>' +
            noteCoord +
          '</div>' +
          '<span style="font-size:11px;padding:3px 8px;border-radius:12px;white-space:nowrap;' + (statoStyle[r.stato]||'') + ';">' + (statoLabel[r.stato]||r.stato) + '</span>' +
        '</div>' +
        azioni +
      '</div>';
    }).join('');
  } catch(e) {
    document.getElementById('richieste-micronido-lista').innerHTML = '<p style="font-size:13px;color:var(--muted);">Errore: ' + e.message + '</p>';
  }
}

async function gestisciRichiestaMicronido(id, esito) {
  const noteEl = document.getElementById('esito-note-' + id);
  const noteCoordinatore = noteEl ? noteEl.value.trim() : '';
  try {
    const docSnap = await col('richieste_assenza').doc(id).get();
    if (!docSnap.exists) return;
    const r = { id: docSnap.id, ...docSnap.data() };

    await col('richieste_assenza').doc(id).update({
      stato: esito,
      noteCoordinatore,
      gestitaAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Se approvata crea voci Ore+ per i giorni del periodo
    if (esito === 'approvata') {
      const tipoOa = r.tipo === 'ferie' ? 'ferie' : r.tipo === 'permesso' ? 'permesso' : 'altro';
      const orDoc = await col('orari_settimanali').doc(r.educatoreId).get();
      const orario = orDoc.exists ? orDoc.data() : {};
      const giorni = ['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];
      const dataDal = new Date(r.dal + 'T12:00:00');
      const dataAl = new Date((r.al || r.dal) + 'T12:00:00');
      for (let d = new Date(dataDal); d <= dataAl; d.setDate(d.getDate() + 1)) {
        const gg = giorni[d.getDay()];
        const oreFull = parseFloat(orario[gg] || 0);
        const ore = r.oreParziali ? r.oreParziali : oreFull;
        if (ore <= 0) continue;
        const dataStr = d.toISOString().slice(0, 10);
        await col('ore_aggiuntive').add({
          educatoreId: r.educatoreId,
          educatoreNome: r.educatoreNome,
          data: dataStr, mese: dataStr.slice(0, 7),
          categoria: tipoOa, ore, note: r.note || '',
          stato: 'validato',
          validatoAt: firebase.firestore.FieldValue.serverTimestamp(),
          validatoDa: 'coordinatore_area',
          richiestaId: id,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    // Notifica educatore
    await col('notifiche').add({
      destinatarioId: r.educatoreId,
      destinatarioNome: r.educatoreNome,
      tipo: 'esito_richiesta',
      testo: 'La tua richiesta di ' + (r.tipoLabel||r.tipo) + ' è stata ' + (esito === 'approvata' ? '✓ approvata' : '✗ rifiutata') + (noteCoordinatore ? ': ' + noteCoordinatore : ''),
      letta: false,
      creatoAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    toast(esito === 'approvata' ? 'Richiesta approvata ✓' : 'Richiesta rifiutata');
    await mostraRichiesteMicronido();
  } catch(e) { toast('Errore: ' + e.message); }
}

async function scaricaCalendarioMicronido() {
  // Usa la stessa logica del calendario coordinatore ma filtrata per micronido
  try {
    const snapEdu = await col('educatori').get();
    const operatori = snapEdu.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.area === 'micronido')
      .sort((a,b) => a.nome.localeCompare(b.nome));

    const snapRich = await col('richieste_assenza').get();
    const idOperatori = new Set(operatori.map(e => e.id));
    const richieste = snapRich.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(r => idOperatori.has(r.educatoreId));

    // Determina mese corrente
    const oggi = new Date();
    const annoN = oggi.getFullYear();
    const mmN = oggi.getMonth() + 1;
    const mese = annoN + '-' + String(mmN).padStart(2,'0');
    const nomeMese = ['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][mmN];
    const giorniMese = new Date(annoN, mmN, 0).getDate();
    const giorni = Array.from({ length: giorniMese }, (_, i) => i + 1);
    const nomiGiorni = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];

    const mappa = {};
    operatori.forEach(e => { mappa[e.id] = {}; });
    richieste.forEach(r => {
      if (!mappa[r.educatoreId]) return;
      const dal = new Date(r.dal + 'T12:00:00');
      const al = new Date((r.al || r.dal) + 'T12:00:00');
      for (let d = new Date(dal); d <= al; d.setDate(d.getDate() + 1)) {
        const aMese = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
        if (aMese !== mese) continue;
        mappa[r.educatoreId][d.getDate()] = { tipo: r.tipo, tipoLabel: r.tipoLabel||r.tipo, stato: r.stato, dalle: r.dalle||null, alle: r.alle||null, oreParziali: r.oreParziali||null };
      }
    });

    const bgColori = { attesa:'#FFF3E0', approvata:'#D1FAE5', rifiutata:'#FDE8E8' };
    const txtColori = { attesa:'#c47a2e', approvata:'#065f46', rifiutata:'#8C0E0E' };
    const statoLabel = { attesa:'?', approvata:'✓', rifiutata:'✗' };
    const tipoSigla = { ferie:'F', permesso:'P', altra_assenza:'A' };

    const thGiorni = giorni.map(g => {
      const dow = new Date(annoN, mmN-1, g).getDay();
      const isWe = dow === 0 || dow === 6;
      return '<th style="width:28px;text-align:center;padding:4px 2px;font-size:10px;background:' + (isWe?'#e5e7eb':'#1a3a5c') + ';color:' + (isWe?'#6b7280':'white') + ';border:1px solid #ddd;">' +
        '<div style="font-weight:700;">' + g + '</div><div style="font-size:9px;">' + nomiGiorni[dow] + '</div></th>';
    }).join('');

    const righe = operatori.map(e => {
      const celle = giorni.map(g => {
        const dow = new Date(annoN, mmN-1, g).getDay();
        const isWe = dow === 0 || dow === 6;
        const cell = mappa[e.id]?.[g];
        if (!cell) return '<td style="background:' + (isWe?'#f3f4f6':'white') + ';border:1px solid #eee;"></td>';
        const bg = bgColori[cell.stato]||'#eee';
        const txt = txtColori[cell.stato]||'#333';
        const sigla = tipoSigla[cell.tipo]||'?';
        const stato = statoLabel[cell.stato]||'';
        const oreLabel = cell.dalle && cell.alle ? '<div style="font-size:7px;color:'+txt+';line-height:1.2;">'+cell.dalle+'-'+cell.alle+'</div>' : cell.oreParziali ? '<div style="font-size:8px;color:'+txt+';">'+cell.oreParziali+'h</div>' : '';
        return '<td style="background:'+bg+';border:1px solid #ddd;text-align:center;padding:2px 1px;">' +
          '<div style="font-size:10px;font-weight:700;color:'+txt+';">'+sigla+'</div>' +
          '<div style="font-size:9px;color:'+txt+';">'+stato+'</div>' + oreLabel + '</td>';
      }).join('');
      return '<tr><td style="padding:4px 8px;font-size:11px;font-weight:600;border:1px solid #eee;white-space:nowrap;background:#f8fafc;">'+e.nome+'</td>'+celle+'</tr>';
    }).join('');

    const html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>CalendarioMicronido_' + String(mmN).padStart(2,'0') + annoN + '</title>' +
      '<style>body{font-family:Arial,sans-serif;font-size:12px;margin:16px;}.header{display:flex;align-items:center;border-bottom:2px solid #1a3a5c;padding-bottom:10px;margin-bottom:14px;}.header h2{color:#1a3a5c;font-size:14px;margin:0 0 2px;}.header p{font-size:11px;color:#666;margin:0;}table{border-collapse:collapse;}.legenda{margin-top:16px;display:flex;gap:16px;font-size:11px;flex-wrap:wrap;}.leg-item{display:flex;align-items:center;gap:6px;}.leg-box{width:28px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;}@media print{body{margin:8px;}@page{size:A4 landscape;margin:8mm;}}</style></head><body>' +
      '<div class="header"><div><h2>Il Filo di Arianna — Richieste Micronido</h2><p>' + nomeMese + ' ' + annoN + '</p></div></div>' +
      '<div style="overflow-x:auto;"><table><thead><tr><th style="text-align:left;padding:4px 8px;font-size:11px;background:#1a3a5c;color:white;border:1px solid #ddd;min-width:120px;">Operatore</th>' + thGiorni + '</tr></thead><tbody>' + righe + '</tbody></table></div>' +
      '<div class="legenda"><div class="leg-item"><div class="leg-box" style="background:#D1FAE5;color:#065f46;">F✓</div>Ferie approvata</div><div class="leg-item"><div class="leg-box" style="background:#FFF3E0;color:#c47a2e;">F?</div>In attesa</div><div class="leg-item"><div class="leg-box" style="background:#FDE8E8;color:#8C0E0E;">F✗</div>Rifiutata</div><div class="leg-item"><div class="leg-box" style="background:#D1FAE5;color:#065f46;">P✓</div>Permesso</div></div>' +
      '</body></html>';

    const w = window.open('', '_blank');
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(function() { w.print(); }, 600);
    toast('Calendario micronido aperto ✓');
  } catch(e) { toast('Errore: ' + e.message); }
}

async function renderServiziLista() {
  const wrap = document.getElementById('admin-servizi-lista');
  if (!wrap) return;
  try {
    const snap = await col('servizi').get();
    const servizi = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.nome||'').localeCompare(b.nome||''));

    if (!servizi.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Nessun servizio configurato.</p>';
      return;
    }

    wrap.innerHTML = servizi.map(s => {
      const educatori = (s.educatori || []).map(e => e.nome).join(', ') || 'Nessun educatore assegnato';
      const tipoLabel = s.tipo === 'micronido' ? '🧸 Micronido'
        : s.tipo === 'doposcuola' ? '🏫 Doposcuola'
        : s.tipo === 'centro_estivo' ? '☀️ Centro Estivo'
        : '📋 ' + (s.tipo || 'Servizio');
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;">${s.nome}</div>
            <div style="font-size:11px;color:var(--muted);">${tipoLabel}${s.comune ? ' · ' + s.comune : ''}</div>
            <div style="font-size:11px;color:var(--accent);margin-top:2px;">👤 ${educatori}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button onclick="apriModificaServizio('${s.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;">Modifica</button>
            <button onclick="eliminaServizio('${s.id}','${(s.nome||'').replace(/'/g,"\\'")}')
" style="background:none;border:1px solid var(--danger);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--danger);">Elimina</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Errore caricamento servizi.</p>';
  }
}

let serviziEducatori = []; // cache educatori per il form servizio

async function apriFormNuovoServizio() {
  document.getElementById('admin-lista-view').style.display = 'none';
  document.getElementById('admin-servizio-form-view').style.display = 'block';
  document.getElementById('servizio-form-title').textContent = 'Nuovo servizio';
  document.getElementById('servizio-id').value = '';
  document.getElementById('sv-tipo').value = 'doposcuola';
  document.getElementById('sv-nome').value = '';
  document.getElementById('sv-comune').value = '';
  document.getElementById('sv-sede').value = '';
  await caricaCheckboxEducatori([]);
}

async function apriModificaServizio(id) {
  const snap = await col('servizi').doc(id).get();
  if (!snap.exists) return;
  const s = { id: snap.id, ...snap.data() };
  document.getElementById('admin-lista-view').style.display = 'none';
  document.getElementById('admin-servizio-form-view').style.display = 'block';
  document.getElementById('servizio-form-title').textContent = 'Modifica servizio';
  document.getElementById('servizio-id').value = id;
  document.getElementById('sv-tipo').value = s.tipo || 'doposcuola';
  document.getElementById('sv-nome').value = s.nome || '';
  document.getElementById('sv-comune').value = s.comune || '';
  document.getElementById('sv-sede').value = s.sede || '';
  await caricaCheckboxEducatori(s.educatori || []);
}

async function caricaCheckboxEducatori(assegnati) {
  const wrap = document.getElementById('sv-edu-lista');
  try {
    const educatori = await syncGetEducatori();
    serviziEducatori = educatori;
    const assegnatiIds = assegnati.map(e => e.id);
    wrap.innerHTML = educatori.map(e => `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer;">
        <input type="checkbox" value="${e.id}" ${assegnatiIds.includes(e.id) ? 'checked' : ''}
          style="width:16px;height:16px;cursor:pointer;">
        ${e.nome}
      </label>`).join('');
  } catch(e) {
    wrap.innerHTML = '<p style="font-size:12px;color:var(--muted);">Errore caricamento educatori.</p>';
  }
}

async function salvaServizio() {
  const id = document.getElementById('servizio-id').value;
  const tipo = document.getElementById('sv-tipo').value;
  const nome = document.getElementById('sv-nome').value.trim();
  const comune = document.getElementById('sv-comune').value.trim();
  const sede = document.getElementById('sv-sede').value.trim();

  if (!nome) { toast('Inserisci il nome del servizio'); return; }

  // Raccogli educatori selezionati
  const checkboxes = document.querySelectorAll('#sv-edu-lista input[type="checkbox"]:checked');
  const educatori = Array.from(checkboxes).map(cb => {
    const edu = serviziEducatori.find(e => e.id === cb.value);
    return { id: cb.value, nome: edu ? edu.nome : '' };
  });

  const data = { tipo, nome, comune, sede, educatori, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };

  try {
    if (id) {
      await col('servizi').doc(id).update(data);
    } else {
      await col('servizi').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }

    // Crea/aggiorna gli interventi per ogni educatore assegnato
    await sincronizzaInterventiServizio(id || null, tipo, nome, comune, sede, educatori);

    tornaAdminLista();
    toast('Servizio salvato ✓');
  } catch(err) {
    toast('Errore: ' + err.message);
  }
}

async function sincronizzaInterventiServizio(servizioId, tipo, nome, comune, sede, educatori) {
  // Per ogni educatore assegnato, crea l'intervento se non esiste già
  for (const edu of educatori) {
    const snap = await col('interventi')
      .where('educatoreId', '==', edu.id)
      .where('minore', '==', nome)
      .where('tipo', '==', tipo)
      .get();
    if (snap.empty) {
      await col('interventi').add({
        educatoreId: edu.id,
        minore: nome,
        scuola: sede || comune || '',
        comune: comune,
        tipo: tipo,
        servizioId: servizioId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }
}

async function eliminaServizio(id, nome) {
  if (!confirm('Eliminare il servizio "' + nome + '"?\nGli interventi degli educatori assegnati verranno rimossi.')) return;
  try {
    await col('servizi').doc(id).delete();
    // Elimina gli interventi collegati
    const snap = await col('interventi').where('servizioId', '==', id).get();
    const batch = col('servizi').firestore.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    await renderServiziLista();
    toast('Servizio eliminato');
  } catch(err) {
    toast('Errore: ' + err.message);
  }
}

function renderAdminLista() {
  const wrap = document.getElementById('admin-minori-lista');
  const tutti = [...diarioMinori].sort((a, b) => a.nome.localeCompare(b.nome));

  if (!tutti.length) {
    wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Nessun minore. Aggiungi il primo.</p>';
    return;
  }

  wrap.innerHTML = tutti.map(m => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:600;">${m.nome} ${m.attivo === false ? '<span style="color:var(--muted);font-size:11px;">(archiviato)</span>' : ''}</div>
        <div style="font-size:11px;color:var(--muted);">${m.comune || ''} · ${m.aree || ''}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="apriModificaMinore('${m.id}')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;">Modifica</button>
        <button onclick="archiviaMinore('${m.id}',${m.attivo !== false})" style="background:none;border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--muted);">${m.attivo === false ? 'Riattiva' : 'Archivia'}</button>
      </div>
    </div>`).join('');
}

async function apriFormNuovoMinore() {
  document.getElementById('admin-lista-view').style.display = 'none';
  document.getElementById('admin-form-view').style.display = 'block';
  document.getElementById('admin-form-title').textContent = 'Nuovo minore';
  document.getElementById('admin-minore-id').value = '';
  document.getElementById('am-nome').value = '';
  document.getElementById('am-comune').value = '';
  document.getElementById('am-scuola').value = '';
  document.getElementById('am-aree').value = 'scolastico';
  document.getElementById('am-edu-scol').value = '';
  document.getElementById('am-edu-scol2').value = '';
  document.getElementById('am-edu-extra').value = '';

  // Carica lista educatori per i select
  await caricaSelectEducatori();
}

async function apriModificaMinore(id) {
  const m = diarioMinori.find(x => x.id === id);
  if (!m) return;

  document.getElementById('admin-lista-view').style.display = 'none';
  document.getElementById('admin-form-view').style.display = 'block';
  document.getElementById('admin-form-title').textContent = 'Modifica minore';
  document.getElementById('admin-minore-id').value = m.id;
  document.getElementById('am-nome').value = m.nome || '';
  document.getElementById('am-comune').value = m.comune || '';
  document.getElementById('am-scuola').value = m.scuola || '';
  document.getElementById('am-aree').value = m.aree || 'scolastico';
  await caricaSelectEducatori();
  document.getElementById('am-edu-scol').value = m.educatoreIdScolastico || '';
  document.getElementById('am-edu-scol2').value = m.educatoreIdScolastico2 || '';
  document.getElementById('am-edu-extra').value = m.educatoreIdExtra || '';
}

async function caricaSelectEducatori() {
  try {
    const educatori = await syncGetEducatori();
    const opzioni = educatori
      .filter(e => (e.area || '') !== 'micronido')
      .map(e => `<option value="${e.id}">${e.nome}</option>`)
      .join('');
    document.getElementById('am-edu-scol').innerHTML = '<option value="">— nessuno —</option>' + opzioni;
    document.getElementById('am-edu-scol2').innerHTML = '<option value="">— nessuno —</option>' + opzioni;
    document.getElementById('am-edu-extra').innerHTML = '<option value="">— nessuno —</option>' + opzioni;
  } catch (e) { /* silenzioso */ }
}

function tornaAdminLista() {
  document.getElementById('admin-form-view').style.display = 'none';
  document.getElementById('admin-servizio-form-view').style.display = 'none';
  document.getElementById('admin-lista-view').style.display = 'block';
  renderServiziLista();
}

async function salvaMinore() {
  const id = document.getElementById('admin-minore-id').value;
  const nome = document.getElementById('am-nome').value.trim();
  const comune = document.getElementById('am-comune').value.trim();
  const scuola = document.getElementById('am-scuola').value.trim();
  const aree = document.getElementById('am-aree').value;
  const eduScolId = document.getElementById('am-edu-scol').value;
  const eduScol2Id = document.getElementById('am-edu-scol2').value;
  const eduExtraId = document.getElementById('am-edu-extra').value;

  if (!nome) { toast('Inserisci il nome del minore'); return; }

  // Recupera nomi educatori
  let educatoreNomeScolastico = '';
  let educatoreNomeScolastico2 = '';
  let educatoreNomeExtra = '';
  try {
    const educatori = await syncGetEducatori();
    if (eduScolId) educatoreNomeScolastico = (educatori.find(e => e.id === eduScolId) || {}).nome || '';
    if (eduScol2Id) educatoreNomeScolastico2 = (educatori.find(e => e.id === eduScol2Id) || {}).nome || '';
    if (eduExtraId) educatoreNomeExtra = (educatori.find(e => e.id === eduExtraId) || {}).nome || '';
  } catch (e) { /* silenzioso */ }

  const data = {
    nome, comune, scuola, aree,
    educatoreIdScolastico: eduScolId,
    educatoreNomeScolastico,
    educatoreIdScolastico2: eduScol2Id,
    educatoreNomeScolastico2,
    educatoreIdExtra: eduExtraId,
    educatoreNomeExtra,
    attivo: true
  };

  try {
    if (id) {
      await syncUpdateMinore(id, data);
      toast('Minore aggiornato ✓');
    } else {
      await syncAddMinore(data);
      toast('Minore aggiunto ✓');
    }
    await caricaMinoriDiario();
    tornaAdminLista();
    renderAdminLista();
  } catch (err) {
    toast('Errore: ' + err.message);
  }
}

async function archiviaMinore(id, attivoCorrente) {
  const azione = attivoCorrente ? 'archiviare' : 'riattivare';
  if (!confirm(`Vuoi ${azione} questo minore?`)) return;
  try {
    await syncUpdateMinore(id, { attivo: !attivoCorrente });
    await caricaMinoriDiario();
    renderAdminLista();
    toast('Fatto ✓');
  } catch (err) {
    toast('Errore: ' + err.message);
  }
}

// ── PANNELLO SOSTITUZIONE (coordinatori area) ──

async function initSostituzioni() {
  await caricaMinoriDiario();
  const wrap = document.getElementById('sost-lista');
  const educatori = await syncGetEducatori();
  const attivi = educatori.filter(e => (e.area || '') !== 'micronido' && e.ruolo !== 'coordinatore_pedagogico');

  wrap.innerHTML = diarioMinori
    .filter(m => m.attivo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map(m => {
      const opzioni = attivi.map(e => `<option value="${e.id}"${e.id === m.educatoreIdScolastico ? ' selected' : ''}>${e.nome}</option>`).join('');
      const opzioni2 = attivi.map(e => `<option value="${e.id}"${e.id === m.educatoreIdScolastico2 ? ' selected' : ''}>${e.nome}</option>`).join('');
      const opzioniExtra = attivi.map(e => `<option value="${e.id}"${e.id === m.educatoreIdExtra ? ' selected' : ''}>${e.nome}</option>`).join('');

      return `<div class="card" style="margin-bottom:10px;">
        <div style="font-weight:700;font-size:14px;margin-bottom:10px;">${m.nome}</div>
        ${(m.aree === 'scolastico' || m.aree === 'entrambe') ? `
        <div class="fg"><div class="fld-l">Educatore scolastico</div>
        <select onchange="aggiornaSostituzione('${m.id}','scolastico',this.value,this.options[this.selectedIndex].text)">
          <option value="">— nessuno —</option>${opzioni}
        </select></div>
        <div class="fg"><div class="fld-l">2° Educatore scolastico (se presente)</div>
        <select onchange="aggiornaSostituzione('${m.id}','scolastico2',this.value,this.options[this.selectedIndex].text)">
          <option value="">— nessuno —</option>${opzioni2}
        </select></div>` : ''}
        ${(m.aree === 'domiciliare' || m.aree === 'entrambe') ? `
        <div class="fg"><div class="fld-l">Educatore domiciliare</div>
        <select onchange="aggiornaSostituzione('${m.id}','domiciliare',this.value,this.options[this.selectedIndex].text)">
          <option value="">— nessuno —</option>${opzioniExtra}
        </select></div>` : ''}
      </div>`;
    }).join('');
}

async function aggiornaSostituzione(minoreId, tipo, eduId, eduNome) {
  const aggiornamento = {};
  if (tipo === 'scolastico') {
    aggiornamento.educatoreIdScolastico = eduId;
    aggiornamento.educatoreNomeScolastico = eduNome;
  } else if (tipo === 'scolastico2') {
    aggiornamento.educatoreIdScolastico2 = eduId;
    aggiornamento.educatoreNomeScolastico2 = eduNome || '';
  } else {
    aggiornamento.educatoreIdExtra = eduId;
    aggiornamento.educatoreNomeExtra = eduNome;
  }
  try {
    await syncUpdateMinore(minoreId, aggiornamento);
    await caricaMinoriDiario();
    toast('Assegnazione aggiornata ✓');
  } catch (err) {
    toast('Errore: ' + err.message);
  }
}
