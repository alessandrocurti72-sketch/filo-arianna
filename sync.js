// sync.js — Layer sincronizzazione Firebase Firestore
// Il Filo di Arianna – Presenze PWA

const firebaseConfig = {
  apiKey: "AIzaSyC1zB3CWrz3DFD2BwgYg0MlmPnOqid3aLY",
  authDomain: "il-filo-di-arianna---presenze.firebaseapp.com",
  projectId: "il-filo-di-arianna---presenze",
  storageBucket: "il-filo-di-arianna---presenze.firebasestorage.app",
  messagingSenderId: "528980391785",
  appId: "1:528980391785:web:5be7fedf23fa55929aaff8"
};

let _db = null;

function _getDb() {
  if (_db) return _db;
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  _db = firebase.firestore();
  _db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code === 'failed-precondition') console.warn('Offline: più tab aperte');
    if (err.code === 'unimplemented') console.warn('Offline persistence non supportata');
  });
  return _db;
}

const col = name => _getDb().collection(name);

// ── EDUCATORI ──

async function syncGetEducatori() {
  const snap = await col('educatori').get({ source: 'server' });
  const risultati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return risultati.sort((a, b) => a.nome.localeCompare(b.nome));
}

async function syncAddEducatore(data) {
  const ref = await col('educatori').add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { id: ref.id, ...data };
}

async function syncDeleteEducatore(id) {
  await col('educatori').doc(id).delete();
}

// ── INTERVENTI ──

async function syncGetInterventi(educatoreId) {
  const snap = await col('interventi')
    .where('educatoreId', '==', educatoreId)
    .get({ source: 'server' });
  const risultati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return risultati.sort((a, b) => a.minore.localeCompare(b.minore));
}

async function syncAddIntervento(data) {
  const ref = await col('interventi').add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { id: ref.id, ...data };
}

async function syncDeleteIntervento(id) {
  await col('interventi').doc(id).delete();
}

// ── TIMBRATURE ──

async function syncAddTimbratura(data) {
  const ref = await col('timbrature').add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { id: ref.id, ...data };
}

async function syncUpdateTimbratura(id, updates) {
  await col('timbrature').doc(id).update({
    ...updates,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function syncGetTimbratureByMese(educatoreId, mese) {
  const snap = await col('timbrature')
    .where('educatoreId', '==', educatoreId)
    .where('mese', '==', mese)
    .get();
  const risultati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return risultati.sort((a, b) => a.data.localeCompare(b.data));
}

async function syncGetTimbratureAperte(educatoreId) {
  const oggi = oggiISO();
  const snap = await col('timbrature')
    .where('educatoreId', '==', educatoreId)
    .where('data', '==', oggi)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.uscita);
}

// ── COORDINATORE ──

async function syncGetTutteTimbrature(mese) {
  let snap;
  if (mese) {
    snap = await col('timbrature').where('mese', '==', mese).get();
  } else {
    snap = await col('timbrature').get();
  }
  const risultati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return risultati.sort((a, b) => b.data.localeCompare(a.data));
}

async function syncGetTuttiEducatori() {
  const snap = await col('educatori').get();
  const risultati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return risultati.sort((a, b) => a.nome.localeCompare(b.nome));
}

async function syncGetTuttiInterventi() {
  const snap = await col('interventi').get();
  const risultati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return risultati.sort((a, b) => a.minore.localeCompare(b.minore));
}

async function syncClearAll() {
  console.warn('syncClearAll non disponibile con Firebase');
}

// ── VALIDAZIONI QR ──

async function syncCreaTokenValidazione(data) {
  // Genera un token univoco e crea il documento su Firebase
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await col('validazioni').doc(token).set({
    ...data,
    stato: 'attesa',
    creatoAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return token;
}

async function syncAscollaValidazione(token, callback) {
  // Ascolta in tempo reale il documento validazione
  return col('validazioni').doc(token).onSnapshot(function(doc) {
    if (doc.exists && doc.data().stato === 'validato') {
      callback(true);
    }
  });
}

async function syncGetValidazioniEducatore(educatoreId, mese) {
  const snap = await col('validazioni')
    .where('educatoreId', '==', educatoreId)
    .where('mese', '==', mese)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function syncGetValidazioni(educatoreId, mese) {
  const snap = await col('validazioni')
    .where('educatoreId', '==', educatoreId)
    .where('mese', '==', mese)
    .get();
  return snap.docs.map(d => ({ id: d.id, token: d.id, ...d.data() }));
}

async function syncGetTutteValidazioni(mese) {
  let snap;
  if (mese) {
    snap = await col('validazioni').where('mese', '==', mese).get();
  } else {
    snap = await col('validazioni').get();
  }
  return snap.docs.map(d => ({ id: d.id, token: d.id, ...d.data() }));
}

async function syncSalvaValidazione(token, firma, timbrature) {
  await col('validazioni').doc(token).update({
    stato: 'validato',
    firma: firma,
    timbrature: timbrature,
    validatoAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function syncGetTokenValidazione(token) {
  const doc = await col('validazioni').doc(token).get();
  if (!doc.exists) return null;
  return { id: doc.id, token: doc.id, ...doc.data() };
}

async function syncAddNotificaUrgenzaCollega(data) {
  await col('notifiche_collega').add(data);
}

async function syncGetNotificheCollega(educatoreId, minoreId) {
  const snap = await col('notifiche_collega')
    .where('destinatarioId', '==', educatoreId)
    .where('minoreId', '==', minoreId)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function syncSegnaNotificaCollegaLetta(notificaId) {
  await col('notifiche_collega').doc(notificaId).update({ letto: true });
}

// ── MINORI ──

async function syncGetMinori() {
  const snap = await col('minori').get({ source: 'server' });
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function syncAddMinore(data) {
  const ref = await col('minori').add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { id: ref.id, ...data };
}

async function syncUpdateMinore(id, data) {
  await col('minori').doc(id).update({
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ── DIARIO NOTE ──

async function syncGetNoteDiario(minoreId) {
  const snap = await col('diario')
    .where('minoreId', '==', minoreId)
    .get();
  const risultati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return risultati.sort((a, b) => {
    const ta = a.timestamp ? a.timestamp.seconds : 0;
    const tb = b.timestamp ? b.timestamp.seconds : 0;
    return tb - ta;
  });
}

async function syncAddNotaDiario(data) {
  const ref = await col('diario').add(data);
  return { id: ref.id, ...data };
}
async function syncAddCommento(notaId, commento) {
  // Nota: serverTimestamp() non funziona dentro arrayUnion
  // Usiamo un timestamp client
  const commentoConData = {
    ...commento,
    timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
  };
  await col('diario').doc(notaId).update({
    commenti: firebase.firestore.FieldValue.arrayUnion(commentoConData)
  });
}

async function syncDeleteNota(notaId) {
  await col('diario').doc(notaId).delete();
}

async function syncSegnaVisto(notaId, utente) {
  const doc = await col('diario').doc(notaId).get();
  if (!doc.exists) return;
  const vistoDA = doc.data().vistoDA || [];
  if (!vistoDA.some(v => v.id === utente.id)) {
    await col('diario').doc(notaId).update({
      vistoDA: firebase.firestore.FieldValue.arrayUnion(utente)
    });
  }
}

async function syncGetUrgenze() {
  const snap = await col('diario')
    .where('urgente', '==', true)
    .get();
  const urgenteSnap = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const snapDom = await col('diario')
    .where('domandaCoord', '>', '')
    .get();
  const domande = snapDom.docs.map(d => ({ id: d.id, ...d.data() }));

  // Unisci e de-duplica
  const tutti = [...urgenteSnap];
  domande.forEach(d => {
    if (!tutti.find(u => u.id === d.id)) tutti.push(d);
  });

  return tutti.sort((a, b) => {
    const ta = a.timestamp ? a.timestamp.seconds : 0;
    const tb = b.timestamp ? b.timestamp.seconds : 0;
    return tb - ta;
  });
}

// ── Utility condivise ──

function oggiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function meseISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function oraAttuale() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function calcolaOre(entrata, uscita) {
  if (!entrata || !uscita) return null;
  const [he, me] = entrata.split(':').map(Number);
  const [hu, mu] = uscita.split(':').map(Number);
  const diff = (hu * 60 + mu) - (he * 60 + me);
  return diff > 0 ? (diff / 60) : null;
}

function formatData(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function iniziali(nome) {
  return nome.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function nomiMesi() {
  return ['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
}

// ── NOTIFICHE IN-APP ──

async function syncAddNotifica(data) {
  await col('notifiche').add({
    ...data,
    letta: false,
    creatoAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function syncGetNotificheNonLette(destinatarioId) {
  const snap = await col('notifiche')
    .where('destinatarioId', '==', destinatarioId)
    .where('letta', '==', false)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.creatoAt?.seconds||0) - (a.creatoAt?.seconds||0));
}

async function syncSegnaNotificheAllLette(destinatarioId) {
  const snap = await col('notifiche')
    .where('destinatarioId', '==', destinatarioId)
    .where('letta', '==', false)
    .get();
  const batch = _getDb().batch();
  snap.docs.forEach(d => batch.update(d.ref, { letta: true }));
  if (snap.docs.length) await batch.commit();
}

// ── ORE AGGIUNTIVE ──

async function syncAddOraAggiuntiva(data) {
  const ref = await col('ore_aggiuntive').add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return { id: ref.id, ...data };
}

async function syncUpdateOraAggiuntiva(id, updates) {
  await col('ore_aggiuntive').doc(id).update({
    ...updates,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function syncDeleteOraAggiuntiva(id) {
  await col('ore_aggiuntive').doc(id).delete();
}

async function syncGetOreAggiuntiveByMese(educatoreId, mese) {
  const snap = await col('ore_aggiuntive')
    .where('educatoreId', '==', educatoreId)
    .where('mese', '==', mese)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

async function syncGetTutteOreAggiuntive(mese) {
  const snap = await col('ore_aggiuntive').where('mese', '==', mese).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

// ── ORARIO SETTIMANALE EDUCATORI ──

async function syncSalvaOrarioEducatore(educatoreId, orario) {
  await col('orari_settimanali').doc(educatoreId).set({
    educatoreId,
    ...orario,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function syncGetOrarioEducatore(educatoreId) {
  const doc = await col('orari_settimanali').doc(educatoreId).get();
  return doc.exists ? doc.data() : null;
}

async function syncGetTuttiOrari() {
  const snap = await col('orari_settimanali').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
