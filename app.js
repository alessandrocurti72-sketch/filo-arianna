// build:1785672090
// app.js — Logica app educatore
// Il Filo di Arianna – Presenze PWA

let currentEdu = null;
let interventi = [];
let selectedIntervento = null;
let activeTimbr = null;

// ── BOOT ──

window.addEventListener('DOMContentLoaded', async () => {
  aggiornaOrologio();
  setInterval(aggiornaOrologio, 30000);

  const salvato = sessionStorage.getItem('edu_session');
  if (salvato) {
    const edu = JSON.parse(salvato);
    try {
      const educatori = await syncGetEducatori();
      const trovato = educatori.find(e => e.id === edu.id);
      if (trovato) {
        currentEdu = trovato;
        avviaApp();
      } else {
        // Profilo vecchio non trovato su Firebase: forza nuovo login
        sessionStorage.removeItem('edu_session');
        await renderLogin();
      }
    } catch(err) {
      // Offline: usa profilo in cache
      currentEdu = edu;
      avviaApp();
    }
  } else {
    await renderLogin();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// ── LOGIN ──

async function renderLogin() {
  let educatori = [];
  try {
    educatori = await syncGetEducatori();
  } catch(e) {
    educatori = [];
  }
  const lista = document.getElementById('edu-list');
  const preferito = localStorage.getItem('filo_preferito_id');

  // Se c'è un preferito impostato, vai diretto al PIN
  if (preferito && educatori.length) {
    const eduPref = educatori.find(e => e.id === preferito);
    if (eduPref) {
      document.getElementById('login-step1-title').textContent = 'Ciao, ' + eduPref.nome.split(' ')[0];
      lista.style.display = 'none';
      // Mostra direttamente il pannello PIN con nome e tasto "non sono io"
      lista.innerHTML = `
        <div style="text-align:center;margin-bottom:16px;">
          <div style="width:56px;height:56px;border-radius:50%;background:#e07b10;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;margin:0 auto 8px;">${iniziali(eduPref.nome)}</div>
          <div style="font-size:15px;font-weight:700;color:#1a3a5c;">${eduPref.nome}</div>
          <div style="font-size:11px;color:#e07b10;margin-top:2px;">⭐ profilo predefinito</div>
        </div>`;
      lista.style.display = 'block';
      eduIdSelezionato = eduPref.id;
      document.getElementById('pin-step').style.display = 'block';
      document.getElementById('pin-input').value = '';
      document.getElementById('pin-error').style.display = 'none';
      // Sostituisce il tasto "← Indietro" con "Non sono io"
      document.querySelector('#pin-step button').textContent = 'Non sono io →';
      document.querySelector('#pin-step button').onclick = function() {
        localStorage.removeItem('filo_preferito_id');
        document.getElementById('pin-step').style.display = 'none';
        renderLogin();
      };
      setTimeout(() => document.getElementById('pin-input').focus(), 100);
      return;
    }
  }

  if (!educatori.length) {
    lista.innerHTML = `
      <p style="font-size:13px;color:#6b7280;margin-bottom:14px;">Nessun profilo trovato. Crea il tuo.</p>
      <div class="fg"><div class="fld-l" style="color:#6b7280;">Il tuo nome</div><input type="text" id="new-edu-nome" placeholder="Es. Mario Rossi" style="margin-top:4px;"></div>
      <div class="fg mt8"><div class="fld-l" style="color:#6b7280;">PIN (4 cifre)</div><input type="password" inputmode="numeric" maxlength="4" id="new-edu-pin" placeholder="••••" style="margin-top:4px;letter-spacing:6px;text-align:center;font-size:20px;"></div>
      <button class="bt bt-pri bt-blk mt12" onclick="creaEducatore()" style="background:#1a3a5c;color:white;">Crea profilo</button>`;
    document.getElementById('login-step1-title').textContent = 'Primo accesso';
    return;
  }

  // Nessun preferito: mostra lista completa
  let ordinati = [...educatori];
  lista.innerHTML = ordinati.map(e => `
    <button class="edu-btn" onclick="selezionaEdu('${e.id}','${e.nome.replace(/'/g,"\\'")}')">
      <div class="av" style="width:36px;height:36px;font-size:13px;background:#1a3a5c;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">${iniziali(e.nome)}</div>
      <div class="edu-btn-nome">${e.nome}</div>
    </button>`).join('');

  lista.innerHTML += `
    <button class="edu-btn" onclick="mostraFormNuovoProfilo()" style="margin-top:8px;border-style:dashed;">
      <div class="av" style="width:36px;height:36px;font-size:18px;background:#e8f0f8;color:#1a3a5c;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">+</div>
      <div class="edu-btn-nome" style="color:#1a3a5c;">Nuovo profilo</div>
    </button>`;

  document.getElementById('login-step1-title').textContent = 'Seleziona il tuo profilo';
}

function mostraFormNuovoProfilo() {
  document.getElementById('edu-list').innerHTML = `
    <p style="font-size:13px;color:#6b7280;margin-bottom:14px;">Crea un nuovo profilo educatore.</p>
    <div class="fg"><div class="fld-l" style="color:#6b7280;">Il tuo nome</div><input type="text" id="new-edu-nome" placeholder="Es. Mario Rossi" style="margin-top:4px;"></div>
    <div class="fg mt8"><div class="fld-l" style="color:#6b7280;">PIN (4 cifre)</div><input type="password" inputmode="numeric" maxlength="4" id="new-edu-pin" placeholder="••••" style="margin-top:4px;letter-spacing:6px;text-align:center;font-size:20px;"></div>
    <button class="bt bt-pri bt-blk mt12" onclick="creaEducatore()" style="background:#1a3a5c;color:white;">Crea profilo</button>
    <button class="bt bt-sec bt-blk mt8" onclick="renderLogin()">← Torna alla lista</button>`;
  document.getElementById('login-step1-title').textContent = 'Nuovo profilo';
}

let eduIdSelezionato = null;

function selezionaEdu(id, nome) {
  eduIdSelezionato = id;
  document.getElementById('edu-list').style.display = 'none';
  document.getElementById('pin-step').style.display = 'block';
  document.getElementById('login-step1-title').textContent = `Ciao, ${nome.split(' ')[0]}`;
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').style.display = 'none';
  setTimeout(() => document.getElementById('pin-input').focus(), 100);
}

function backToList() {
  document.getElementById('edu-list').style.display = 'block';
  document.getElementById('pin-step').style.display = 'none';
  document.getElementById('login-step1-title').textContent = 'Seleziona il tuo profilo';
  eduIdSelezionato = null;
}

async function checkPin() {
  const pin = document.getElementById('pin-input').value;
  if (pin.length < 4) return;
  try {
    const educatori = await syncGetEducatori();
    const edu = educatori.find(e => e.id === eduIdSelezionato);
    if (edu && edu.pin === pin) {
      currentEdu = edu;
      sessionStorage.setItem('edu_session', JSON.stringify(edu));
      avviaApp();
    } else {
      document.getElementById('pin-error').style.display = 'block';
      document.getElementById('pin-input').value = '';
    }
  } catch(err) {
    alert('Errore di connessione. Controlla la rete e riprova.');
  }
}

async function creaEducatore() {
  const nome = document.getElementById('new-edu-nome').value.trim();
  const pin = document.getElementById('new-edu-pin').value.trim();
  if (!nome) { alert('Inserisci il tuo nome'); return; }
  if (pin.length !== 4 || isNaN(Number(pin))) { alert('Il PIN deve essere di 4 cifre numeriche'); return; }
  try {
    const edu = await syncAddEducatore({ nome, pin });
    currentEdu = edu;
    sessionStorage.setItem('edu_session', JSON.stringify(edu));
    avviaApp();
  } catch(err) {
    alert('Errore durante la creazione del profilo: ' + err.message);
  }
}

async function avviaApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('hdr-edu-nome').textContent = currentEdu.nome;
  document.getElementById('s-nome-edu').textContent = currentEdu.nome;

  // Gestione ruoli — mostra/nascondi voci nav in base al ruolo
  const ruolo = currentEdu.ruolo || '';
  const area = currentEdu.area || '';
  const isMicronido = area === 'micronido';
  const isCoordPed = ruolo === 'coordinatore_pedagogico';
  const isCoordArea = ruolo === 'coordinatore_area';
  const isCoord = isCoordPed || isCoordArea;

  console.log('Login:', currentEdu.nome, '| ruolo:', ruolo, '| isCoord:', isCoord);

  // Diario: nascosto per micronido
  document.getElementById('nav-diario').style.display = isMicronido ? 'none' : '';

  // Bacheca urgenze: solo coordinatori
  document.getElementById('nav-bacheca').style.display = isCoord ? '' : 'none';

  // Admin/Gestione: solo coordinatori
  document.getElementById('nav-admin').style.display = isCoord ? '' : 'none';

  // Per coord area: mostra anche pannello sostituzioni in admin
  if (isCoordArea && !isCoordPed) {
    document.getElementById('card-sostituzioni') && (document.getElementById('card-sostituzioni').style.display = '');
  }

  // Mostra stato preferito
  const preferito = localStorage.getItem('filo_preferito_id');
  const btn = document.getElementById('btn-preferito');
  const status = document.getElementById('preferito-status');
  if (preferito === currentEdu.id) {
    btn.textContent = '★ Rimuovi profilo predefinito';
    btn.style.background = '#e07b10';
    status.textContent = '⭐ Questo è il profilo predefinito su questo dispositivo';
  } else {
    btn.textContent = '⭐ Imposta come profilo predefinito su questo dispositivo';
    btn.style.background = '';
    status.textContent = '';
  }

  const mOggi = meseISO();
  document.getElementById('fil-mese').value = mOggi;
  document.getElementById('exp-mese').value = mOggi;

  await caricaInterventi();
  // Aggiorna minori in background ad ogni apertura
  if (typeof caricaMinoriDiario === 'function') {
    caricaMinoriDiario().then(function() {
      if (typeof renderListaMinori === 'function') renderListaMinori();
    }).catch(function(){});
  }
  if (typeof aggiornaContatoreBadge === 'function') aggiornaContatoreBadge();
  if (typeof mostraPopupNotifiche === 'function') {
    setTimeout(function() { mostraPopupNotifiche(); }, 1500);
  }
}

function logout() {
  sessionStorage.removeItem('edu_session');
  currentEdu = null;
  selectedIntervento = null;
  activeTimbr = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('tpanel').classList.remove('on');
  // Reset login UI
  document.getElementById('edu-list').style.display = 'block';
  document.getElementById('pin-step').style.display = 'none';
  renderLogin();
}

function impostaPreferito() {
  const preferito = localStorage.getItem('filo_preferito_id');
  const btn = document.getElementById('btn-preferito');
  const status = document.getElementById('preferito-status');
  if (preferito === currentEdu.id) {
    localStorage.removeItem('filo_preferito_id');
    btn.textContent = '⭐ Imposta come profilo predefinito su questo dispositivo';
    btn.style.background = '';
    status.textContent = '';
    toast('Profilo predefinito rimosso');
  } else {
    localStorage.setItem('filo_preferito_id', currentEdu.id);
    btn.textContent = '★ Rimuovi profilo predefinito';
    btn.style.background = '#e07b10';
    status.textContent = '⭐ Questo è il profilo predefinito su questo dispositivo';
    toast('Profilo predefinito impostato ✓');
  }
}

// ── NAVIGAZIONE ──

function navTo(page, btn) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('on'));
  document.getElementById('pg-' + page).classList.add('on');
  if (btn) btn.classList.add('on');
  document.getElementById('fab').style.display = page === 'timbra' ? 'flex' : 'none';
  if (page === 'storico') renderStorico();
  if (page === 'export') renderRiepilogo();
  if (page === 'settings') renderSettingsInterventi();
  if (page === 'diario') initDiario();
  if (page === 'bacheca') initBacheca();
  if (page === 'ore_agg') initOreAgg();
  if (page === 'admin') {
    const ruolo = currentEdu.ruolo || '';
    const isCoordPed = ruolo === 'coordinatore_pedagogico';
    const isCoordArea = ruolo === 'coordinatore_area';
    if (isCoordPed || isCoordArea) initAdmin();
  }
}

function setFiltroArea(area, btn) {
  diarioFiltroArea = area;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderListaMinori();
}

function aggiornaOrologio() {
  const d = new Date();
  const gg = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  const el = document.getElementById('hdr-date');
  if (el) el.textContent = gg[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth()+1);
}

// ── INTERVENTI ──

async function aggiornaDatiApp() {
  // Aggiorna tutti i tasti ↻ Aggiorna
  const btns = document.querySelectorAll('[onclick="aggiornaDatiApp()"]');
  btns.forEach(b => { b.disabled = true; b.textContent = '↻…'; });
  const status = document.getElementById('aggiorna-status');
  if (status) status.textContent = '';
  try {
    await caricaInterventi(); // già usa { source: 'server' } via sync.js
    if (typeof caricaMinoriDiario === 'function') {
      await caricaMinoriDiario();
      if (typeof renderListaMinori === 'function') renderListaMinori();
    }
    if (typeof aggiornaContatoreBadge === 'function') await aggiornaContatoreBadge();
    const ora = new Date().toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' });
    if (status) status.textContent = 'Aggiornato ✓ ' + ora;
    toast('Dati aggiornati ✓');
  } catch(err) {
    if (status) status.textContent = 'Errore: ' + err.message;
    toast('Errore aggiornamento');
  } finally {
    btns.forEach(b => { b.disabled = false; b.textContent = '↻ Aggiorna'; });
  }
}

async function caricaInterventi() {
  try {
    interventi = await syncGetInterventi(currentEdu.id);
  } catch(err) {
    interventi = [];
    toast('Errore caricamento interventi: ' + err.message);
  }
  renderInterventi();
}

function renderInterventi() {
  const c = document.getElementById('lista-interventi');
  if (!interventi.length) {
    c.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>Nessun intervento.<br>Aggiungine uno con il tasto +</p></div>';
    document.getElementById('tpanel').classList.remove('on');
    return;
  }
  c.innerHTML = interventi.map(i => {
    const aperto = activeTimbr && activeTimbr.interventoId === i.id && !activeTimbr.uscita;
    const sel = selectedIntervento && selectedIntervento.id === i.id;
    const isServizio = i.tipo === 'micronido' || i.tipo === 'doposcuola';
    const avBg = i.tipo === 'micronido' ? '#7b1fa2' : i.tipo === 'doposcuola' ? '#c47a2e' : '#1a3a5c';
    const subLabel = isServizio
      ? (i.scuola ? i.scuola : (i.tipo === 'micronido' ? 'Servizio Micronido' : 'Servizio Doposcuola'))
      : (i.scuola + (i.comune ? ' — ' + i.comune : ''));
    return '<div class="ii ' + (sel ? 'sel' : '') + '" onclick="selezionaIntervento(\'' + i.id + '\')">' +
      '<div class="av" style="background:' + avBg + '">' + iniziali(i.minore) + '</div>' +
      '<div class="ii-info">' +
        '<div class="ii-nome">' + i.minore + '</div>' +
        '<div class="ii-sub">' + subLabel + '</div>' +
      '</div>' +
      '<span class="bdg ' + (aperto ? 'bdg-in' : 'bdg-out') + '">' + (aperto ? '● IN' : 'OUT') + '</span>' +
    '</div>';
  }).join('');
}

async function selezionaIntervento(id) {
  selectedIntervento = interventi.find(i => i.id === id);
  if (!selectedIntervento) return;
  document.getElementById('tp-nome').textContent = selectedIntervento.minore;
  document.getElementById('tp-sub').textContent = selectedIntervento.scuola + (selectedIntervento.comune ? ' — ' + selectedIntervento.comune : '');
  resetPanel();

  try {
    const aperte = await syncGetTimbratureAperte(currentEdu.id);
    const aperta = aperte.find(t => t.interventoId === id);
    if (aperta) {
      activeTimbr = aperta;
      document.getElementById('disp-in').textContent = aperta.entrata;
      document.getElementById('disp-in').classList.remove('vuoto');
      document.getElementById('btn-in').disabled = true;
      document.getElementById('btn-out').disabled = false;
      document.getElementById('note-inp').value = aperta.note || '';
    } else {
      activeTimbr = null;
      document.getElementById('btn-in').disabled = false;
      document.getElementById('btn-out').disabled = true;
    }
  } catch(err) {
    activeTimbr = null;
    document.getElementById('btn-in').disabled = false;
    document.getElementById('btn-out').disabled = true;
  }

  document.getElementById('tpanel').classList.add('on');
  renderInterventi();
}

function resetPanel() {
  document.getElementById('disp-in').textContent = '--:--';
  document.getElementById('disp-in').classList.add('vuoto');
  document.getElementById('disp-out').textContent = '--:--';
  document.getElementById('disp-out').classList.add('vuoto');
  document.getElementById('note-inp').value = '';
}

function aggiornaFormIntervento(tipo) {
  const isServizio = tipo === 'micronido' || tipo === 'doposcuola';
  document.getElementById('form-minore-fields').style.display = isServizio ? 'none' : 'block';
  document.getElementById('form-servizio-fields').style.display = isServizio ? 'block' : 'none';
}

async function aggiungiIntervento() {
  const tipo = document.getElementById('new-tipo').value;
  const isServizio = tipo === 'micronido' || tipo === 'doposcuola';

  let minore, scuola, comune;

  if (isServizio) {
    // Per micronido/doposcuola il "minore" è il nome del servizio
    minore = tipo === 'micronido' ? 'Micronido' : 'Doposcuola';
    scuola = document.getElementById('new-sede').value.trim() || '';
    comune = '';
  } else {
    minore = document.getElementById('new-minore').value.trim();
    scuola = document.getElementById('new-scuola').value.trim();
    comune = document.getElementById('new-comune').value.trim();
    if (!minore || !scuola) { toast('Inserisci minore e scuola'); return; }
  }

  try {
    await syncAddIntervento({
      educatoreId: currentEdu.id,
      minore,
      scuola,
      comune,
      tipo: tipo  // scolastico | domiciliare | micronido | doposcuola
    });
    closeModal('modal-int');
    // Reset form
    document.getElementById('new-tipo').value = 'scolastico';
    document.getElementById('new-minore').value = '';
    document.getElementById('new-scuola').value = '';
    document.getElementById('new-comune').value = '';
    document.getElementById('new-sede').value = '';
    aggiornaFormIntervento('scolastico');
    await caricaInterventi();
    toast('Aggiunto: ' + minore);
  } catch(err) {
    toast('Errore: ' + err.message);
    console.error('Errore aggiungiIntervento:', err);
  }
}

function renderSettingsInterventi() {
  const c = document.getElementById('s-int-lista');
  if (!interventi.length) {
    c.innerHTML = '<p style="font-size:13px;color:#6b7280;">Nessun intervento configurato.</p>';
    return;
  }
  c.innerHTML = interventi.map(i =>
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:600;">' + i.minore + '</div>' +
        '<div style="font-size:11px;color:var(--muted);">' + i.scuola + '</div>' +
      '</div>' +
      '<button onclick="rimuoviIntervento(\'' + i.id + '\')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;color:var(--danger);">Rimuovi</button>' +
    '</div>'
  ).join('');
}

async function rimuoviIntervento(id) {
  if (!confirm('Rimuovere questo intervento?')) return;
  try {
    await syncDeleteIntervento(id);
    if (selectedIntervento && selectedIntervento.id === id) {
      selectedIntervento = null;
      activeTimbr = null;
      document.getElementById('tpanel').classList.remove('on');
    }
    await caricaInterventi();
    renderSettingsInterventi();
  } catch(err) {
    toast('Errore rimozione: ' + err.message);
  }
}

// ── QR CODE VALIDAZIONE ──

async function renderRiepilogo() {
  const mese = document.getElementById('exp-mese').value;
  const wrap = document.getElementById('riepilogo');
  const cardQr = document.getElementById('card-qr-list');
  const qrList = document.getElementById('qr-minori-list');
  try {
    const timb = await syncGetTimbratureByMese(currentEdu.id, mese);
    if (!timb.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:#6b7280;">Nessuna timbratura registrata.</p>';
      cardQr.style.display = 'none';
      return;
    }

    // Legge il tipo dall'intervento — usa una mappa minore->tipo[] per supportare più tipi
    const tipoPerMinore = {};
    interventi.forEach(function(i) {
      if (!tipoPerMinore[i.minore]) tipoPerMinore[i.minore] = [];
      const t = i.tipo || 'scolastico';
      if (!tipoPerMinore[i.minore].includes(t)) tipoPerMinore[i.minore].push(t);
    });

    // Usa chiave minore||tipo per gestire stesso minore con più interventi
    const perMinore = {};
    timb.forEach(function(t) {
      // Priorità: 1) tipo nella timbratura, 2) intervento con tipo corrispondente, 3) primo intervento, 4) scolastico
      const tipoTimb = t.tipo || '';
      let tipoEffettivo = tipoTimb;
      if (!tipoEffettivo) {
        // Cerca intervento con tipo corrispondente
        const intCorrispondente = interventi.find(function(i) {
          return i.minore === t.minore && i.educatoreId === t.educatoreId && i.tipo;
        });
        tipoEffettivo = (intCorrispondente && intCorrispondente.tipo) || 'scolastico';
      }
      const chiave = t.minore + '||' + tipoEffettivo;

      if (!perMinore[chiave]) perMinore[chiave] = {
        minore: t.minore,
        ore: 0,
        scuola: t.scuola,
        comune: t.comune || '',
        tipo: tipoEffettivo,
        timb: []
      };
      perMinore[chiave].ore += calcolaOre(t.entrata, t.uscita) || 0;
      perMinore[chiave].timb.push(t);
    });

    const totale = Object.values(perMinore).reduce(function(a,b){return a+b.ore;}, 0);
    wrap.innerHTML = Object.values(perMinore).map(function(dati) {
      const tipoLabel = dati.tipo === 'domiciliare' ? ' (dom.)' : dati.tipo === 'scolastico' ? ' (scol.)' : '';
      return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;"><span>' + dati.minore + '<span style="font-size:11px;color:var(--muted);">' + tipoLabel + '</span></span><strong>' + dati.ore.toFixed(2) + 'h</strong></div>';
    }).join('') +
    '<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px;font-weight:700;"><span>Totale mese</span><span style="color:var(--primary);">' + totale.toFixed(2) + 'h</span></div>';

    // Carica validazioni esistenti per mostrare stati
    let validazioniEsistenti = [];
    try {
      validazioniEsistenti = await syncGetValidazioniEducatore(currentEdu.id, mese);
    } catch(e) { /* ignora */ }

    // Mostra lista QR per ogni minore
    cardQr.style.display = 'block';
    const parti = mese.split('-');
    const anno = parti[0];
    const mm = parseInt(parti[1]);
    const nomeMese = nomiMesi()[mm];

    qrList.innerHTML = Object.entries(perMinore).map(function(entry) {
      const dati = entry[1];
      const minore = dati.minore;
      const tipo = dati.tipo;
      const isDomiciliare = tipo === 'domiciliare' || tipo === 'micronido' || tipo === 'doposcuola' || tipo === 'centro_estivo';

      // Controlla stato validazione esistente
      const valEsistente = validazioniEsistenti.find(function(v) {
        return v.minore === minore && v.tipo === tipo;
      });
      const statoTag = valEsistente
        ? (valEsistente.stato === 'validato'
            ? '<span style="font-size:11px;background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;margin-left:4px;">✓ Validato</span>'
            : '<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;margin-left:4px;">⏳ In attesa</span>')
        : '';

      const labelTipoTesto = tipo === 'micronido' ? 'Micronido → firma coordinatore'
        : tipo === 'doposcuola' ? 'Doposcuola → firma coordinatore'
        : isDomiciliare ? 'Domiciliare → firma coordinatore'
        : 'Scolastico → firma referente';
      const labelTipoColore = isDomiciliare ? '#c47a2e' : '#1a7040';
      const labelTipoBg = isDomiciliare ? '#fff8f0' : '#e8f5ee';
      const labelTipo = '<span style="font-size:11px;background:' + labelTipoBg + ';color:' + labelTipoColore + ';padding:2px 6px;border-radius:4px;margin-left:6px;">' + labelTipoTesto + '</span>';

      const btnDisabled = valEsistente && valEsistente.stato !== 'validato';
      const btnHtml = isDomiciliare
        ? '<button onclick="inviaAlCoordinatore(\'' + encodeURIComponent(minore) + '\',\'' + encodeURIComponent(dati.scuola) + '\',\'' + mese + '\')" ' +
          'style="padding:8px 14px;border:none;border-radius:8px;background:' + (btnDisabled ? '#ccc' : '#c47a2e') + ';color:white;cursor:pointer;font-size:13px;font-weight:600;">' +
          (valEsistente ? (valEsistente.stato === 'validato' ? '✓ Validato' : '⏳ In attesa') : '↑ Invia al coordinatore') +
          '</button>'
        : '<button onclick="apriQR(\'' + encodeURIComponent(minore) + '\',\'' + encodeURIComponent(dati.scuola) + '\',\'' + mese + '\',\'' + tipo + '\')" ' +
          'style="padding:8px 14px;border:none;border-radius:8px;background:var(--primary);color:white;cursor:pointer;font-size:13px;font-weight:600;">' +
          'QR ▶' +
          '</button>';

      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:600;">' + minore + labelTipo + statoTag + '</div>' +
          '<div style="font-size:12px;color:var(--muted);">' + dati.ore.toFixed(2) + 'h · ' + nomeMese + ' ' + anno + '</div>' +
        '</div>' +
        btnHtml +
      '</div>';
    }).join('');

  } catch(err) {
    wrap.innerHTML = '<p style="font-size:13px;color:#6b7280;">Errore caricamento dati.</p>';
  }
}

async function apriQR(minoreEnc, scuolaEnc, mese, tipo) {
  const minore = decodeURIComponent(minoreEnc);
  const scuola = decodeURIComponent(scuolaEnc);
  tipo = tipo || 'scolastico';
  const parti = mese.split('-');
  const anno = parti[0];
  const mm = parseInt(parti[1]);
  const nomeMese = nomiMesi()[mm];

  const token = await syncCreaTokenValidazione({
    educatoreId: currentEdu.id,
    educatoreNome: currentEdu.nome,
    minore: minore,
    scuola: scuola,
    mese: mese,
    nomeMese: nomeMese,
    anno: anno,
    tipo: tipo
  });

  const baseUrl = window.location.origin;
  const url = baseUrl + '/valida.html?t=' + token;

  const isDomiciliare = tipo === 'domiciliare' || tipo === 'micronido' || tipo === 'doposcuola' || tipo === 'centro_estivo';
  document.getElementById('qr-titolo').textContent = minore;
  document.getElementById('qr-sottotitolo').textContent = nomeMese + ' ' + anno + ' · ' + (isDomiciliare ? 'Validazione coordinatore' : scuola);
  document.getElementById('qr-stato').style.display = 'none';

  const container = document.getElementById('qr-container');
  container.innerHTML = '';

  // Usa qrcode-generator (API: qrcode(typeNumber, errorCorrectionLevel))
  var qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  // Genera SVG inline
  var size = 220;
  var moduleCount = qr.getModuleCount();
  var cellSize = Math.floor(size / moduleCount);
  var svgCells = '';
  for (var row = 0; row < moduleCount; row++) {
    for (var col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        svgCells += '<rect x="' + (col * cellSize) + '" y="' + (row * cellSize) + '" width="' + cellSize + '" height="' + cellSize + '" fill="#1a3a5c"/>';
      }
    }
  }
  var svgSize = moduleCount * cellSize;
  container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + svgSize + '" height="' + svgSize + '" viewBox="0 0 ' + svgSize + ' ' + svgSize + '" style="background:white;padding:8px;border-radius:8px;">' + svgCells + '</svg>';

  openModal('modal-qr');

  // Ascolta in tempo reale se il referente ha firmato
  syncAscollaValidazione(token, function(validato) {
    if (validato) {
      document.getElementById('qr-stato').style.display = 'block';
      toast('Foglio validato dal referente ✓', 4000);
    }
  });
}

// ── TIMBRATURA ──

async function timbraEntrata() {
  if (!selectedIntervento) return;
  const ora = oraAttuale();
  const record = {
    educatoreId: currentEdu.id,
    educatoreNome: currentEdu.nome,
    interventoId: selectedIntervento.id,
    minore: selectedIntervento.minore,
    scuola: selectedIntervento.scuola,
    comune: selectedIntervento.comune || '',
    tipo: selectedIntervento.tipo || 'scolastico',
    data: oggiISO(),
    mese: meseISO(),
    entrata: ora,
    uscita: '',
    note: ''
  };
  try {
    activeTimbr = await syncAddTimbratura(record);
    // GPS silenzioso solo per micronido
    if (currentEdu.area === 'micronido' && navigator.geolocation) {
      const tId = activeTimbr.id;
      navigator.geolocation.getCurrentPosition(function(pos) {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        syncUpdateTimbratura(tId, { gpsEntrata: lat + ',' + lon, gpsAccEntrata: Math.round(pos.coords.accuracy) }).catch(function(){});
      }, function(){}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }
    document.getElementById('disp-in').textContent = ora;
    document.getElementById('disp-in').classList.remove('vuoto');
    document.getElementById('btn-in').disabled = true;
    document.getElementById('btn-out').disabled = false;
    renderInterventi();
    toast('Entrata: ' + ora);
  } catch(err) {
    toast('Errore timbratura: ' + err.message);
    console.error('Errore timbraEntrata:', err);
  }
}

async function timbraUscita() {
  if (!activeTimbr) return;
  const ora = oraAttuale();
  // GPS silenzioso all'uscita per micronido
  if (currentEdu.area === 'micronido' && navigator.geolocation) {
    const tId = activeTimbr.id;
    navigator.geolocation.getCurrentPosition(function(pos) {
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      syncUpdateTimbratura(tId, { gpsUscita: lat + ',' + lon, gpsAccUscita: Math.round(pos.coords.accuracy) }).catch(function(){});
    }, function(){}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  try {
    await syncUpdateTimbratura(activeTimbr.id, { uscita: ora });
    activeTimbr.uscita = ora;
    document.getElementById('disp-out').textContent = ora;
    document.getElementById('disp-out').classList.remove('vuoto');
    document.getElementById('btn-out').disabled = true;
    renderInterventi();
    toast('Uscita: ' + ora);
  } catch(err) {
    toast('Errore timbratura uscita: ' + err.message);
  }
}

async function salvaIntervento() {
  if (!activeTimbr) { toast('Avvia prima una timbratura'); return; }
  const note = document.getElementById('note-inp').value;
  const upd = { note };
  if (!activeTimbr.uscita) {
    upd.uscita = oraAttuale();
    document.getElementById('disp-out').textContent = upd.uscita;
    document.getElementById('disp-out').classList.remove('vuoto');
  }
  try {
    await syncUpdateTimbratura(activeTimbr.id, upd);
    activeTimbr = null;
    resetPanel();
    document.getElementById('btn-in').disabled = false;
    document.getElementById('btn-out').disabled = true;
    renderInterventi();
    toast('Intervento salvato \u2713');
  } catch(err) {
    toast('Errore salvataggio: ' + err.message);
  }
}

// ── STORICO ──

async function renderStorico() {
  const mese = document.getElementById('fil-mese').value;
  const wrap = document.getElementById('storico-wrap');
  try {
    const timb = await syncGetTimbratureByMese(currentEdu.id, mese);
    if (!timb.length) {
      wrap.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p>Nessuna timbratura per questo mese.</p></div>';
      return;
    }
    timb.sort(function(a,b) { return b.data.localeCompare(a.data); });
    wrap.innerHTML = timb.map(function(t) {
      const ore = calcolaOre(t.entrata, t.uscita);
      return '<div class="si">' +
        '<div class="si-hd"><span class="si-nome">' + t.minore + '</span><span class="si-data">' + formatData(t.data) + '</span></div>' +
        '<div class="si-det">' +
          '<span>' + (t.entrata || '--') + ' \u2192 ' + (t.uscita || '\u2026') + '</span>' +
          (ore ? '<span class="si-ore">' + ore.toFixed(2) + 'h</span>' : '') +
          (t.note ? '<span>' + t.note.slice(0,40) + (t.note.length>40?'\u2026':'') + '</span>' : '') +
          (t.gpsEntrata ? '<span>\ud83d\udccd</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  } catch(err) {
    wrap.innerHTML = '<div class="empty"><p>Errore caricamento storico.</p></div>';
  }
}

// ── EXPORT XLSX ──

async function esportaXlsx() {
  const mese = document.getElementById('exp-mese').value;
  if (!mese) { toast('Seleziona un mese'); return; }
  try {
    const timb = await syncGetTimbratureByMese(currentEdu.id, mese);
    const parti = mese.split('-');
    const anno = parti[0];
    const mm = parseInt(parti[1]);
    const nm = nomiMesi();
    const nomeMese = nm[mm];
    const wb = XLSX.utils.book_new();

    const gruppi = {};
    timb.forEach(function(t) {
      const k = t.minore + '||' + t.scuola;
      if (!gruppi[k]) gruppi[k] = { minore: t.minore, scuola: t.scuola, comune: t.comune || '', timb: [] };
      gruppi[k].timb.push(t);
    });

    if (!Object.keys(gruppi).length) {
      const ws = XLSX.utils.aoa_to_sheet([['Nessuna timbratura per questo mese.']]);
      XLSX.utils.book_append_sheet(wb, ws, 'Vuoto');
    } else {
      Object.values(gruppi).forEach(function(g) {
        const ws = creaFoglio(g, nomeMese, anno, mm, currentEdu.nome);
        const nomeSheet = (g.minore + ' - ' + g.scuola).slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, nomeSheet);
      });
    }

    XLSX.writeFile(wb, 'Presenze_' + currentEdu.nome.replace(/\s+/g,'_') + '_' + nomeMese + '_' + anno + '.xlsx');
    toast('File .xlsx scaricato \u2713');
  } catch(err) {
    toast('Errore export: ' + err.message);
  }
}

function creaFoglio(g, nomeMese, anno, mm, nomeEdu) {
  const giorniMese = new Date(parseInt(anno), mm, 0).getDate();
  const isServizio = g.tipo === 'micronido' || g.tipo === 'doposcuola';
  const etichetta = isServizio ? 'SERVIZIO' : 'MINORE';

  const righe = [
    ['Il Filo di Arianna - Foglio Presenze', '', '', '', '', '', ''],
    ['Cooperativa Sociale Il Filo di Arianna', '', '', '', '', '', ''],
    [etichetta + ': ' + g.minore + (g.comune ? '   COMUNE: ' + g.comune : ''), '', '', '', '', '', ''],
    ['SEDE: ' + (g.scuola || '—'), '', '', '', '', '', ''],
    ['Mese di ' + nomeMese + ' ' + anno, '', '', '', '', '', ''],
    ['', 'Operatore: ' + nomeEdu, '', '', '', '', ''],
    [''],
    ['Giorno', 'Dalle', 'Alle', 'Tot Ore', 'Note', '', '']
  ];

  for (var gg = 1; gg <= giorniMese; gg++) {
    var dataStr = anno + '-' + String(mm).padStart(2,'0') + '-' + String(gg).padStart(2,'0');
    var t = g.timb.find(function(x) { return x.data === dataStr; });
    var ore = t ? calcolaOre(t.entrata, t.uscita) : null;
    righe.push([
      gg,
      t ? (t.entrata || '') : '',
      t ? (t.uscita || '') : '',
      ore !== null ? parseFloat(ore.toFixed(2)) : '',
      t ? (t.note || '') : '',
      t ? (t.gpsEntrata || '') : '',
      t ? (t.gpsUscita || '') : ''
    ]);
  }

  var totOre = g.timb.reduce(function(s, t) { return s + (calcolaOre(t.entrata, t.uscita) || 0); }, 0);
  righe.push(['']);
  righe.push(['TOTALE ORE', '', '', parseFloat(totOre.toFixed(2)), '', '', '']);
  righe.push(['']);
  righe.push(['Referente / Coordinatore', '', '', '', '', '', '']);

  var ws = XLSX.utils.aoa_to_sheet(righe);
  ws['!cols'] = [{wch:8},{wch:8},{wch:8},{wch:10},{wch:32},{wch:28},{wch:28}];
  return ws;
}



// ── EXPORT PDF ──

async function esportaPDF() {
  const mese = document.getElementById('exp-mese').value;
  if (!mese) { toast('Seleziona un mese'); return; }
  try {
    const timb = await syncGetTimbratureByMese(currentEdu.id, mese);
    if (!timb.length) { toast('Nessuna timbratura per questo mese'); return; }
    const parti = mese.split('-');
    const anno = parti[0];
    const mm = parseInt(parti[1]);
    const nomeMese = nomiMesi()[mm];

    // Raggruppa per minore+tipo — chiave senza scuola per evitare split su varianti del nome
    const gruppi = {};
    timb.forEach(function(t) {
      // Priorità: 1) tipo nella timbratura, 2) intervento con tipo corrispondente, 3) scolastico
      let tipoEffettivo = t.tipo || '';
      if (!tipoEffettivo) {
        const intCorrispondente = interventi.find(function(i) {
          return i.minore === t.minore && i.educatoreId === t.educatoreId && i.tipo;
        });
        tipoEffettivo = (intCorrispondente && intCorrispondente.tipo) || 'scolastico';
      }
      const k = t.minore + '||' + tipoEffettivo;
      if (!gruppi[k]) gruppi[k] = {
        minore: t.minore,
        scuola: t.scuola,
        comune: t.comune || '',
        tipo: tipoEffettivo,
        timb: []
      };
      gruppi[k].timb.push(t);
    });

    var logoHtml = (typeof LOGO_B64 !== 'undefined')
      ? '<img src="' + LOGO_B64 + '" style="height:48px;margin-right:16px;">'
      : '';

    // Genera un PDF per ogni minore/servizio
    Object.values(gruppi).forEach(function(g) {
      const isServizio = g.tipo === 'micronido' || g.tipo === 'doposcuola';
      const isDomiciliare = g.tipo === 'domiciliare' || g.tipo === 'micronido' || g.tipo === 'doposcuola' || g.tipo === 'centro_estivo';
      const totOre = g.timb.reduce(function(s,t){ return s+(calcolaOre(t.entrata,t.uscita)||0); }, 0);
      const righe = g.timb
        .sort(function(a,b){
          const dataA = a.data + (a.entrata||'00:00');
          const dataB = b.data + (b.entrata||'00:00');
          return dataA.localeCompare(dataB);
        })
        .map(function(t) {
          const ore = calcolaOre(t.entrata, t.uscita);
          const parts = t.data.split('-');
          return '<tr><td>' + parts[2]+'/'+parts[1]+'/'+parts[0] + '</td><td>' + (t.entrata||'—') + '</td><td>' + (t.uscita||'—') + '</td><td>' + (ore?ore.toFixed(2)+'h':'—') + '</td><td>' + (t.note||'') + '</td></tr>';
        }).join('');

      const firmaLabel = isDomiciliare ? 'Firma Coordinatore' : isServizio ? 'Responsabile Servizio' : 'Referente Scolastico';

      const html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">' +
        '<style>body{font-family:Arial,sans-serif;font-size:12px;margin:24px;}' +
        '.header{display:flex;align-items:center;border-bottom:2px solid #1a3a5c;padding-bottom:12px;margin-bottom:16px;}' +
        '.header h2{color:#1a3a5c;font-size:15px;margin:0 0 2px;}' +
        '.header p{font-size:11px;color:#666;margin:0;}' +
        '.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;}' +
        '.meta div{padding:5px 8px;background:#f5f5f5;border-radius:4px;}' +
        '.meta label{font-size:10px;color:#888;display:block;}' +
        'table{width:100%;border-collapse:collapse;margin-bottom:14px;}' +
        'th{background:#1a3a5c;color:white;padding:6px 8px;text-align:left;font-size:11px;}' +
        'td{padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;}' +
        '.tot{text-align:right;font-weight:700;padding:8px;background:#f5f5f5;}' +
        '.firma{margin-top:28px;display:flex;justify-content:space-between;}' +
        '.firma-box{width:45%;border-top:1px solid #999;padding-top:6px;font-size:11px;color:#666;}' +
        '</style></head><body>' +
        '<div class="header">' + logoHtml +
          '<div><h2>Il Filo di Arianna — Foglio Presenze</h2><p>Cooperativa Sociale Il Filo di Arianna</p></div>' +
        '</div>' +
        '<div class="meta">' +
          '<div><label>' + (isServizio ? 'Servizio' : 'Minore') + '</label>' + g.minore + '</div>' +
          '<div><label>' + (isServizio ? 'Sede' : 'Scuola') + '</label>' + (g.scuola || '—') + '</div>' +
          '<div><label>Operatore</label>' + currentEdu.nome + '</div>' +
          '<div><label>Mese</label>' + nomeMese + ' ' + anno + '</div>' +
        '</div>' +
        '<table><thead><tr><th>Data</th><th>Entrata</th><th>Uscita</th><th>Ore</th><th>Note</th></tr></thead>' +
        '<tbody>' + righe + '</tbody></table>' +
        '<div class="tot">Totale ore: ' + totOre.toFixed(2) + 'h</div>' +
        '<div class="firma">' +
          '<div class="firma-box">' + firmaLabel + '</div>' +
        '</div>' +
        '</body></html>';

      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(function(){ w.print(); }, 400);
    });
  } catch(err) {
    toast('Errore PDF: ' + err.message);
  }
}

async function inviaAlCoordinatore(minoreEnc, scuolaEnc, mese) {
  const minore = decodeURIComponent(minoreEnc);
  const scuola = decodeURIComponent(scuolaEnc);
  const parti = mese.split('-');
  const anno = parti[0];
  const mm = parseInt(parti[1]);
  const nomeMese = nomiMesi()[mm];

  // Controlla se esiste già una validazione in attesa o validata
  try {
    const snap = await syncGetValidazioniEducatore(currentEdu.id, mese);
    const esistente = snap.find(function(v) { return v.minore === minore && (v.tipo === 'domiciliare' || v.tipo === 'micronido' || v.tipo === 'doposcuola'); });
    if (esistente) {
      if (esistente.stato === 'validato') {
        toast('Foglio già validato dal coordinatore ✓');
      } else {
        toast('Foglio già inviato — in attesa di validazione');
      }
      return;
    }
  } catch(e) { /* continua */ }

  // Genera il PDF come HTML string
  const timb = await syncGetTimbratureByMese(currentEdu.id, mese);
  const timbMinore = timb.filter(function(t) { return t.minore === minore; })
    .sort(function(a,b){ return a.data.localeCompare(b.data); });

  const totOre = timbMinore.reduce(function(s,t){ return s+(calcolaOre(t.entrata,t.uscita)||0); }, 0);
  const righeHtml = timbMinore.map(function(t) {
    const ore = calcolaOre(t.entrata, t.uscita);
    const p = t.data.split('-');
    return '<tr><td>' + p[2]+'/'+p[1]+'/'+p[0] + '</td><td>' + (t.entrata||'—') + '</td><td>' + (t.uscita||'—') + '</td><td>' + (ore?ore.toFixed(2)+'h':'—') + '</td><td>' + (t.note||'') + '</td></tr>';
  }).join('');

  const logoHtml = (typeof LOGO_B64 !== 'undefined') ? '<img src="' + LOGO_B64 + '" style="height:44px;margin-right:14px;">' : '';

  const pdfHtml = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">' +
    '<style>body{font-family:Arial,sans-serif;font-size:12px;margin:24px;}' +
    '.header{display:flex;align-items:center;border-bottom:2px solid #1a3a5c;padding-bottom:12px;margin-bottom:16px;}' +
    '.header h2{color:#1a3a5c;font-size:15px;margin:0 0 2px;}.header p{font-size:11px;color:#666;margin:0;}' +
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;}' +
    '.meta div{padding:5px 8px;background:#f5f5f5;border-radius:4px;}' +
    '.meta label{font-size:10px;color:#888;display:block;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:14px;}' +
    'th{background:#1a3a5c;color:white;padding:6px 8px;text-align:left;font-size:11px;}' +
    'td{padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;}' +
    '.tot{text-align:right;font-weight:700;padding:8px;background:#f5f5f5;}' +
    '.firma{margin-top:28px;border-top:1px solid #999;padding-top:8px;font-size:11px;color:#666;width:50%;}' +
    '</style></head><body>' +
    '<div class="header">' + logoHtml +
      '<div><h2>Il Filo di Arianna — Foglio Presenze Domiciliare</h2>' +
      '<p>Cooperativa Sociale Il Filo di Arianna</p></div></div>' +
    '<div class="meta">' +
      '<div><label>Minore</label>' + minore + '</div>' +
      '<div><label>Tipo intervento</label>Domiciliare</div>' +
      '<div><label>Educatore</label>' + currentEdu.nome + '</div>' +
      '<div><label>Mese</label>' + nomeMese + ' ' + anno + '</div>' +
    '</div>' +
    '<table><thead><tr><th>Data</th><th>Entrata</th><th>Uscita</th><th>Ore</th><th>Note</th></tr></thead>' +
    '<tbody>' + righeHtml + '</tbody></table>' +
    '<div class="tot">Totale ore: ' + totOre.toFixed(2) + 'h</div>' +
    '<div class="firma">Firma Coordinatore</div>' +
    '</body></html>';

  try {
    // Recupera il tipo dall'intervento
    const interventoTrovato = interventi.find(function(i) { return i.minore === minore; });
    const tipo = interventoTrovato ? (interventoTrovato.tipo || 'domiciliare') : 'domiciliare';

    await syncCreaTokenValidazione({
      educatoreId: currentEdu.id,
      educatoreNome: currentEdu.nome,
      minore: minore,
      scuola: scuola,
      comune: interventoTrovato ? (interventoTrovato.comune || '') : '',
      mese: mese,
      nomeMese: nomeMese,
      anno: anno,
      tipo: tipo,
      pdfHtml: pdfHtml
    });
    toast('Foglio inviato al coordinatore ✓', 3500);
    await renderRiepilogo();
  } catch(err) {
    toast('Errore: ' + err.message);
  }
}

// ── MODAL ──

function openModal(id) { document.getElementById(id).classList.add('on'); }
function closeModal(id) { document.getElementById(id).classList.remove('on'); }
function handleOvClick(e, id) { if (e.target.id === id) closeModal(id); }

// ── TOAST ──

function toast(msg, ms) {
  ms = ms || 2500;
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(function() { t.classList.remove('on'); }, ms);
}

// ── ORE AGGIUNTIVE ──

function setOreAggTab(tab) {
  const isRegistra = tab === 'registra';
  document.getElementById('oa-panel-registra').style.display = isRegistra ? 'block' : 'none';
  document.getElementById('oa-panel-richieste').style.display = isRegistra ? 'none' : 'block';
  const tabR = document.getElementById('tab-oa-registra');
  const tabRich = document.getElementById('tab-oa-richieste');
  tabR.style.fontWeight = isRegistra ? '700' : '600';
  tabR.style.color = isRegistra ? 'var(--primary)' : 'var(--muted)';
  tabR.style.borderBottom = isRegistra ? '2px solid var(--primary)' : 'none';
  tabRich.style.fontWeight = isRegistra ? '600' : '700';
  tabRich.style.color = isRegistra ? 'var(--muted)' : 'var(--primary)';
  tabRich.style.borderBottom = isRegistra ? 'none' : '2px solid var(--primary)';
  if (!isRegistra) caricaRichieste();
}

function aggiornaFormRichiesta() {
  const tipo = document.getElementById('rich-tipo').value;
  const wrap = document.getElementById('rich-ore-wrap');
  if (wrap) wrap.style.display = tipo === 'permesso' ? 'block' : 'none';
}

function calcolaOreDalleAlle() {
  const dalle = document.getElementById('rich-dalle')?.value;
  const alle = document.getElementById('rich-alle')?.value;
  const calc = document.getElementById('rich-ore-calc');
  if (!calc) return 0;
  if (!dalle || !alle) { calc.textContent = ''; return 0; }
  const ore = calcolaOre(dalle, alle) || 0;
  calc.textContent = ore > 0 ? '→ ' + ore.toFixed(2) + ' ore' : '';
  return ore;
}

async function inviaRichiesta() {
  const tipo = document.getElementById('rich-tipo').value;
  const dal = document.getElementById('rich-dal').value;
  const al = document.getElementById('rich-al').value || dal;
  const note = document.getElementById('rich-note').value.trim();
  const oreEl = document.getElementById('rich-ore');
  const dalleEl = document.getElementById('rich-dalle');
  const alleEl = document.getElementById('rich-alle');
  const dalle = (tipo === 'permesso' && dalleEl) ? dalleEl.value : null;
  const alle = (tipo === 'permesso' && alleEl) ? alleEl.value : null;
  const oreParziali = (dalle && alle) ? (calcolaOre(dalle, alle) || null) : null;
  if (!dal) { toast('Inserisci almeno la data di inizio'); return; }

  const tipoLabel = { ferie:'Ferie', permesso:'Permesso', altra_assenza:'Altra assenza' };
  try {
    const dataRich = {
      educatoreId: currentEdu.id,
      educatoreNome: currentEdu.nome,
      tipo, tipoLabel: tipoLabel[tipo] || tipo,
      dal, al,
      note,
      stato: 'attesa',
      creatoAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (oreParziali) { dataRich.oreParziali = oreParziali; dataRich.dalle = dalle; dataRich.alle = alle; }
    await col('richieste_assenza').add(dataRich);
    // Notifica coordinatori
    const snapEdu = await col('educatori').get();
    const coordinatori = snapEdu.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.ruolo === 'coordinatore_pedagogico' || e.ruolo === 'coordinatore_area');
    for (const coord of coordinatori) {
      await syncAddNotifica({
        destinatarioId: coord.id,
        destinatarioNome: coord.nome,
        tipo: 'richiesta_assenza',
        testo: currentEdu.nome + ' ha inviato una richiesta di ' + (tipoLabel[tipo]||tipo) + ' (' + formatData(dal) + (al !== dal ? ' → ' + formatData(al) : '') + ')',
        notaId: ''
      });
    }
    document.getElementById('rich-dal').value = '';
    document.getElementById('rich-al').value = '';
    document.getElementById('rich-note').value = '';
    if (dalleEl) dalleEl.value = '';
    if (alleEl) alleEl.value = '';
    if (document.getElementById('rich-ore-calc')) document.getElementById('rich-ore-calc').textContent = '';
    toast('Richiesta inviata ✓');
    await caricaRichieste();
  } catch(err) { toast('Errore: ' + err.message); }
}

async function caricaRichieste() {
  const wrap = document.getElementById('rich-lista');
  if (!wrap) return;
  wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Caricamento…</p>';
  try {
    const snap = await col('richieste_assenza')
      .where('educatoreId', '==', currentEdu.id)
      .get();
    const richieste = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.creatoAt?.seconds||0) - (a.creatoAt?.seconds||0));

    // Aggiorna badge
    const pendenti = richieste.filter(r => r.stato === 'approvata' && !r.vistaDaEducatore).length;
    const badge = document.getElementById('badge-richieste');
    if (badge) { badge.textContent = pendenti; badge.style.display = pendenti ? 'inline' : 'none'; }

    if (!richieste.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Nessuna richiesta inviata.</p>';
      return;
    }

    const statoStyle = {
      attesa: 'background:#fff3e0;color:#c47a2e',
      approvata: 'background:#d1fae5;color:#065f46',
      rifiutata: 'background:#fde8e8;color:#8C0E0E'
    };
    const statoLabel = { attesa:'⏳ In attesa', approvata:'✓ Approvata', rifiutata:'✗ Rifiutata' };

    wrap.innerHTML = richieste.map(r => {
      const periodo = r.dal === r.al ? formatData(r.dal) : formatData(r.dal) + ' → ' + formatData(r.al);
      const notaCoord = r.noteCoordinatore ? '<div style="font-size:11px;color:#6b7280;margin-top:4px;">Nota coordinatore: ' + r.noteCoordinatore + '</div>' : '';
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border);">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
          '<div>' +
            '<div style="font-size:14px;font-weight:600;">' + (r.tipoLabel||r.tipo) + '</div>' +
            '<div style="font-size:12px;color:var(--muted);">' + periodo + (r.dalle && r.alle ? ' · dalle ' + r.dalle + ' alle ' + r.alle + ' (' + (r.oreParziali||0).toFixed(1) + 'h)' : '') + (r.note ? ' · ' + r.note : '') + '</div>' +
            notaCoord +
          '</div>' +
          '<span style="font-size:11px;padding:3px 8px;border-radius:12px;white-space:nowrap;' + (statoStyle[r.stato]||'') + ';">' + (statoLabel[r.stato]||r.stato) + '</span>' +
        '</div>' +
        (r.stato === 'attesa' ? '<button onclick="eliminaRichiesta(\'' + r.id + '\')" style="margin-top:6px;background:none;border:none;font-size:12px;color:#b52b2b;cursor:pointer;">Annulla richiesta</button>' : '') +
      '</div>';
    }).join('');

    // Segna come viste le approvate/rifiutate non ancora viste
    const nonViste = richieste.filter(r => r.stato !== 'attesa' && !r.vistaDaEducatore);
    for (const r of nonViste) {
      await col('richieste_assenza').doc(r.id).update({ vistaDaEducatore: true });
    }
  } catch(err) {
    wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Errore caricamento.</p>';
  }
}

async function eliminaRichiesta(id) {
  if (!confirm('Annullare questa richiesta?')) return;
  try {
    await col('richieste_assenza').doc(id).delete();
    await caricaRichieste();
    toast('Richiesta annullata');
  } catch(err) { toast('Errore: ' + err.message); }
}

const GIORNI_SETTIMANA = ['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];
let orarioEducatore = null;

async function initOreAgg() {
  try {
    orarioEducatore = await syncGetOrarioEducatore(currentEdu.id);
  } catch(e) { orarioEducatore = null; }

  document.getElementById('oa-data').value = oggiISO();
  document.getElementById('oa-data').onchange = aggiornaOreAgg;

  // Badge richieste con esito non visto
  try {
    const snapR = await col('richieste_assenza').where('educatoreId', '==', currentEdu.id).get();
    const nonViste = snapR.docs.filter(d => d.data().stato !== 'attesa' && !d.data().vistaDaEducatore).length;
    const badge = document.getElementById('badge-richieste');
    if (badge) { badge.textContent = nonViste; badge.style.display = nonViste ? 'inline' : 'none'; }
  } catch(e) { /* silenzioso */ }

  const sel = document.getElementById('oa-mese-filtro');
  sel.innerHTML = '';
  const oggi = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    const val = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const nm = nomiMesi()[d.getMonth()+1] + ' ' + d.getFullYear();
    sel.innerHTML += '<option value="' + val + '"' + (i===0?' selected':'') + '>' + nm + '</option>';
  }
  aggiornaOreAgg();
  await caricaOreAggMese();
}

function aggiornaOreAgg() {
  const cat = document.getElementById('oa-categoria').value;
  const needsManuali = cat === 'permesso' || cat === 'ore_extra';
  const manualiWrap = document.getElementById('oa-ore-manuali-wrap');
  const oreAuto = document.getElementById('oa-ore-auto');

  if (manualiWrap) manualiWrap.style.display = needsManuali ? 'block' : 'none';

  if (!needsManuali && oreAuto) {
    const data = document.getElementById('oa-data').value;
    if (data && orarioEducatore) {
      const giorno = GIORNI_SETTIMANA[new Date(data + 'T12:00:00').getDay()];
      const ore = parseFloat(orarioEducatore[giorno] || 0);
      oreAuto.innerHTML = ore > 0
        ? '<span style="color:var(--primary);">→ ' + ore.toFixed(2) + 'h per ' + giorno + ' (da orario configurato)</span>'
        : '<span style="color:var(--muted);">→ Giorno non lavorativo (0h)</span>';
    } else if (!orarioEducatore) {
      oreAuto.innerHTML = '<span style="color:#c47a2e;">⚠ Orario settimanale non configurato — contatta il coordinatore</span>';
    } else {
      oreAuto.innerHTML = '';
    }
  } else if (oreAuto) {
    oreAuto.innerHTML = '';
  }
}

async function salvaOraAggiuntiva() {
  const data = document.getElementById('oa-data').value;
  const categoria = document.getElementById('oa-categoria').value;
  const note = document.getElementById('oa-note').value.trim();
  if (!data) { toast('Seleziona una data'); return; }

  const needsManuali = categoria === 'permesso' || categoria === 'ore_extra';
  let ore = 0;

  if (needsManuali) {
    ore = parseFloat(document.getElementById('oa-ore-manuali').value || 0);
    if (!ore || ore <= 0) { toast('Inserisci le ore'); return; }
  } else {
    if (!orarioEducatore) { toast('Orario settimanale non configurato — contatta il coordinatore'); return; }
    const giorno = GIORNI_SETTIMANA[new Date(data + 'T12:00:00').getDay()];
    ore = parseFloat(orarioEducatore[giorno] || 0);
  }

  const parti = data.split('-');
  const mese = parti[0] + '-' + parti[1];

  try {
    await syncAddOraAggiuntiva({
      educatoreId: currentEdu.id,
      educatoreNome: currentEdu.nome,
      data, mese, categoria, ore, note,
      stato: 'attesa'
    });
    document.getElementById('oa-note').value = '';
    document.getElementById('oa-ore-manuali') && (document.getElementById('oa-ore-manuali').value = '');
    toast('Registrato ✓');
    await caricaOreAggMese();
  } catch(err) {
    toast('Errore: ' + err.message);
  }
}

async function caricaOreAggMese() {
  const mese = document.getElementById('oa-mese-filtro').value;
  const lista = document.getElementById('oa-lista');
  const totEl = document.getElementById('oa-totale');
  lista.innerHTML = '<p style="font-size:13px;color:var(--muted);">Caricamento…</p>';
  try {
    const voci = await syncGetOreAggiuntiveByMese(currentEdu.id, mese);
    if (!voci.length) {
      lista.innerHTML = '<p style="font-size:13px;color:var(--muted);">Nessuna voce per questo mese.</p>';
      totEl.textContent = '';
      return;
    }
    const catLabel = { malattia:'🤒 Malattia', ferie:'🏖 Ferie', permesso:'🕐 Permesso', ore_extra:'⏱ Ore Extra' };
    const totale = voci.reduce((s, v) => s + (v.ore || 0), 0);
    lista.innerHTML = voci.map(v => {
      const [y,m,d] = v.data.split('-');
      const validato = v.stato === 'validato'
        ? '<span style="color:#065f46;font-size:11px;">✓ Validato</span>'
        : '<span style="color:#c47a2e;font-size:11px;">⏳ In attesa</span>';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);">' +
        '<div>' +
          '<div style="font-size:13px;font-weight:600;">' + (catLabel[v.categoria]||v.categoria) + '</div>' +
          '<div style="font-size:11px;color:var(--muted);">' + d+'/'+m+'/'+y + (v.note ? ' · ' + v.note : '') + '</div>' +
          '<div style="margin-top:2px;">' + validato + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span style="font-weight:700;">' + v.ore.toFixed(2) + 'h</span>' +
          (v.stato !== 'validato' ? '<button onclick="eliminaOraAgg(\'' + v.id + '\')" style="background:none;border:none;font-size:16px;cursor:pointer;color:#b52b2b;">🗑</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    totEl.innerHTML = 'Totale mese: <span style="color:var(--primary);">' + totale.toFixed(2) + 'h</span>';
  } catch(err) {
    lista.innerHTML = '<p style="font-size:13px;color:var(--muted);">Errore caricamento.</p>';
  }
}

async function eliminaOraAgg(id) {
  if (!confirm('Eliminare questa voce?')) return;
  try {
    await syncDeleteOraAggiuntiva(id);
    await caricaOreAggMese();
    toast('Voce eliminata');
  } catch(err) {
    toast('Errore: ' + err.message);
  }
}