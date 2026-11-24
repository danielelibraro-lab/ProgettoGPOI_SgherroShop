// Nome utilizzato come chiave per memorizzare il carrello nel browser.
const CHIAVE = 'carrello';

// Nome utilizzato come chiave per memorizzare le quantità residue dopo gli acquisti simulati.
const CHIAVE_MAGAZZINO = 'magazzino';

// Ordine consigliato per visualizzare le taglie nelle tendine.
const ORDINE_TAGLIE = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

// Funzione abbreviata: serve a cercare un elemento nel documento tramite selettore CSS.
const $ = (s) => document.querySelector(s);

// Array che conterrà i capi letti dal file JSON.
let capi = [];

// Protegge i dati inseriti nell'HTML dalle sequenze di caratteri HTML pericolose.
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Trasforma un numero nel formato in euro, usando la virgola come separatore decimale.
const euro = (n) => '€ ' + Number(n || 0).toFixed(2).replace('.', ',');

// Legge il carrello dal localStorage. In caso di dati mancanti o non validi restituisce un array vuoto.
const leggiCarrello = () => {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE)) || [];
  } catch {
    return [];
  }
};

// Salva l'array del carrello nel localStorage, convertendolo in testo JSON.
const salvaCarrello = (c) => localStorage.setItem(CHIAVE, JSON.stringify(c));

// Legge le quantità residue salvate dopo gli acquisti simulati, nel formato { id: quantità }.
const leggiMagazzino = () => {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE_MAGAZZINO)) || {};
  } catch {
    return {};
  }
};

// Salva le quantità residue nel localStorage.
const salvaMagazzino = (m) => localStorage.setItem(CHIAVE_MAGAZZINO, JSON.stringify(m));

// Quantità disponibile di un capo: usa quella residua salvata, altrimenti quella scritta nel JSON.
const disponibili = (c) => {
  const q = Number(leggiMagazzino()[c.id] ?? c.quantita);
  return Number.isFinite(q) ? Math.max(q, 0) : 0;
};

// Conta quanti pezzi di un capo sono già nel carrello.
const nelCarrello = (id) => leggiCarrello().filter((x) => String(x.id) === String(id)).length;

// Quando un'immagine non viene caricata, aggiunge una classe CSS per nasconderla e mostrare il segnaposto.
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG') e.target.classList.add('rotta');
}, true);

// Avvia l'applicazione: legge il JSON, prepara i filtri e disegna la pagina.
async function avvia() {
  try {
    // La versione relativa './capi.json' viene risolta rispetto alla pagina aperta.
    // fetch richiede normalmente un server web: aprire direttamente index.html può bloccare il caricamento.
    const r = await fetch('./capi.json');

    if (!r.ok) throw new Error(`Richiesta fallita: ${r.status} ${r.statusText}`);

    capi = await r.json();

    // Controlla che il contenuto letto sia effettivamente un array di oggetti.
    if (!Array.isArray(capi)) throw new Error('capi.json non contiene un array JSON');
  } catch (errore) {
    // Registra il problema nella console degli strumenti sviluppatore.
    console.error('Errore nel caricamento di capi.json:', errore);

    $('#grid').innerHTML = '<p class="empty">Non riesco a leggere capi.json. Avvia il sito con un server locale, per esempio <b>python -m http.server 8000</b>, poi apri <b>http://localhost:8000</b>.</p>';
    $('#count').textContent = '0 capi trovati';
    return;
  }

  // Inserisce i valori presenti nel JSON nelle quattro tendine dei filtri.
  riempiSelect('#f-sesso', 'sesso');
  riempiSelect('#f-colore', 'colore');
  riempiSelect('#f-taglia', 'taglia');

  // Mostra la griglia dei capi e aggiorna il contenuto del carrello.
  disegna();
  aggiornaCarrello();
}

// Riempie una tendina con i valori unici di un campo del JSON.
function riempiSelect(sel, campo) {
  // Per le taglie usa l'ordine predefinito; gli altri valori sono ordinati alfabeticamente.
  const ord = (t) => (ORDINE_TAGLIE.indexOf(t) + 1) || 99;
  const valori = [...new Set(capi.map((c) => c[campo]))]
    .filter((v) => v !== undefined && v !== null && v !== '')
    .sort((a, b) => ord(a) - ord(b) || String(a).localeCompare(String(b)));

  $(sel).insertAdjacentHTML('beforeend', valori.map((v) => `<option>${esc(v)}</option>`).join(''));
}

// Crea l'HTML di una singola scheda prodotto a partire da un oggetto del JSON.
const scheda = (c) => {
  const q = disponibili(c);
  const esaurito = q === 0;

  return `
  <article class="card${esaurito ? ' esaurito' : ''}" data-id="${esc(c.id)}">
    <button class="thumb" type="button" aria-expanded="false" aria-label="Mostra i dettagli di ${esc(c.nome)}">
      <img src="${esc(c.immagine)}" alt="${esc(c.nome)}" loading="lazy">
      <span class="sticker">${esc(c.sesso)}</span>
      ${esaurito ? '<span class="stock-tag">Non disponibile</span>' : ''}
    </button>
    <div class="name"><span>${esc(c.nome)}</span><i aria-hidden="true">▾</i></div>
    <div class="drop"><div class="drop-in"><div class="drop-body">
      <dl>
        <dt>Colore</dt><dd>${esc(c.colore)}</dd>
        <dt>Taglia</dt><dd>${esc(c.taglia)}</dd>
        <dt>Sesso</dt><dd>${esc(c.sesso)}</dd>
        <dt>Prezzo</dt><dd>${euro(c.prezzo)}</dd>
        <dt>Disponibili</dt><dd>${esaurito ? 'Non disponibile' : q}</dd>
      </dl>
      ${esaurito
        ? '<button class="add" type="button" disabled>Non disponibile</button>'
        : '<button class="add" type="button">Aggiungi al carrello</button>'}
    </div></div></div>
  </article>`;
};

// Filtra i capi in base alla ricerca e alle selezioni delle tendine.
function disegna() {
  const q = $('#search').value.trim().toLowerCase();
  const filtri = {
    sesso: $('#f-sesso').value,
    colore: $('#f-colore').value,
    taglia: $('#f-taglia').value
  };

  // Ogni filtro deve corrispondere e il testo cercato deve essere presente nei dati del capo.
  const lista = capi.filter((c) =>
    Object.entries(filtri).every(([k, v]) => !v || c[k] === v) &&
    (!q || [c.nome, c.colore, c.taglia, c.sesso].join(' ').toLowerCase().includes(q))
  );

  // Aggiorna il testo con il numero di risultati trovati.
  $('#count').textContent = lista.length === 1 ? '1 capo trovato' : `${lista.length} capi trovati`;

  // Disegna tutte le schede oppure un messaggio se non ci sono risultati.
  $('#grid').innerHTML = lista.length
    ? lista.map(scheda).join('')
    : '<p class="empty">Nessun capo corrisponde alla ricerca. Prova a togliere un filtro.</p>';
}

// Gestisce i clic nella griglia: apre la scheda oppure aggiunge il prodotto al carrello.
$('#grid').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;

  // Se è stato cliccato il pulsante immagine, apre o chiude i dettagli del capo.
  if (e.target.closest('.thumb')) {
    const apri = !card.classList.contains('open');

    // Chiude tutte le altre schede prima di aprire quella selezionata.
    document.querySelectorAll('.card.open').forEach((c) => {
      c.classList.remove('open');
      c.querySelector('.thumb').setAttribute('aria-expanded', 'false');
    });

    if (apri) {
      card.classList.add('open');
      card.querySelector('.thumb').setAttribute('aria-expanded', 'true');
    }
  } else if (e.target.closest('.add')) {
    // Recupera i dati del capo corrispondente all'id della scheda.
    const capo = capi.find((c) => String(c.id) === card.dataset.id);
    if (!capo) return;

    // Non permette di mettere nel carrello più pezzi di quelli disponibili.
    const btn = e.target.closest('.add');
    const dispo = disponibili(capo);
    if (nelCarrello(capo.id) >= dispo) {
      if (dispo > 0) {
        btn.textContent = 'Hai già tutti i pezzi';
        setTimeout(() => (btn.textContent = 'Aggiungi al carrello'), 1500);
      }
      return;
    }

    // Aggiunge una copia dei dati al carrello e aggiorna il localStorage.
    const carrello = leggiCarrello();
    carrello.push({
      id: capo.id,
      nome: capo.nome,
      immagine: capo.immagine,
      colore: capo.colore,
      taglia: capo.taglia,
      prezzo: capo.prezzo
    });
    salvaCarrello(carrello);
    aggiornaCarrello();

    // Mostra per breve tempo la conferma sul pulsante.
    btn.textContent = 'Aggiunto al carrello';
    btn.classList.add('ok');

    setTimeout(() => {
      btn.textContent = 'Aggiungi al carrello';
      btn.classList.remove('ok');
    }, 1200);

    // Riavvia l'animazione del pulsante del carrello.
    const cb = $('#cart-btn');
    cb.classList.remove('bump');
    void cb.offsetWidth;
    cb.classList.add('bump');
  }
});

// Collega i campi di ricerca e filtro alla funzione che ridisegna la griglia.
['#search', '#f-sesso', '#f-colore', '#f-taglia'].forEach((s) => {
  $(s).addEventListener('input', disegna);
});

// Azzera tutti i campi di ricerca e ricrea la lista completa.
$('#reset').addEventListener('click', () => {
  $('#search').value = '';
  ['#f-sesso', '#f-colore', '#f-taglia'].forEach((s) => ($(s).value = ''));
  disegna();
});

// Aggiorna il numero degli articoli, il totale e l'elenco mostrato nel carrello.
function aggiornaCarrello() {
  const c = leggiCarrello();

  $('#cart-count').textContent = c.length;
  $('#cart-buy').disabled = !c.length;
  messaggio('');
  $('#cart-total').textContent = euro(c.reduce((t, x) => t + (+x.prezzo || 0), 0));

  $('#cart-list').innerHTML = c.length
    ? c.map((x, i) => `
      <li>
        <span class="mini"><img src="${esc(x.immagine)}" alt=""></span>
        <span class="info"><strong>${esc(x.nome)}</strong><small>${esc(x.colore)}, taglia ${esc(x.taglia)}</small><small>${euro(x.prezzo)}</small></span>
        <button class="rm" type="button" data-i="${i}" aria-label="Rimuovi ${esc(x.nome)}">Rimuovi</button>
      </li>`).join('')
    : '<li class="vuoto">Il carrello è vuoto. Apri un capo e aggiungilo.</li>';
}

// Apre o chiude il pannello laterale del carrello.
function mostraCarrello(aperto) {
  $('#cart').classList.toggle('open', aperto);
  $('#overlay').classList.toggle('open', aperto);
  $('#cart').setAttribute('aria-hidden', String(!aperto));
}

// Collega i pulsanti, il pannello scuro e il tasto Escape alle funzioni del carrello.
$('#cart-btn').addEventListener('click', () => mostraCarrello(true));
$('#cart-close').addEventListener('click', () => mostraCarrello(false));
$('#overlay').addEventListener('click', () => mostraCarrello(false));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') mostraCarrello(false);
});

// Mostra un messaggio nel carrello; con errore = true usa lo stile di avviso.
function messaggio(testo, errore = false) {
  const m = $('#cart-msg');
  m.textContent = testo;
  m.classList.toggle('errore', errore);
}

// Simula l'acquisto: toglie dal magazzino i pezzi nel carrello e svuota il carrello.
$('#cart-buy').addEventListener('click', () => {
  const carrello = leggiCarrello();
  if (!carrello.length) return;

  // Conta quanti pezzi di ciascun capo si vogliono acquistare.
  const richiesti = {};
  carrello.forEach((x) => { richiesti[x.id] = (richiesti[x.id] || 0) + 1; });

  // Se un capo non ha pezzi a sufficienza l'acquisto viene annullato.
  const problemi = Object.entries(richiesti)
    .filter(([id, n]) => {
      const c = capi.find((x) => String(x.id) === id);
      return !c || n > disponibili(c);
    })
    .map(([id]) => carrello.find((x) => String(x.id) === id).nome);

  if (problemi.length) {
    messaggio(`Non disponibile: ${problemi.join(', ')}. Rimuovi il capo dal carrello per continuare.`, true);
    return;
  }

  // Scala le quantità acquistate dal magazzino.
  const magazzino = leggiMagazzino();
  const acquistati = Object.entries(richiesti).map(([id, n]) => {
    const c = capi.find((x) => String(x.id) === id);
    magazzino[c.id] = disponibili(c) - n;
    return c;
  });
  salvaMagazzino(magazzino);

  const totale = carrello.reduce((t, x) => t + (+x.prezzo || 0), 0);
  salvaCarrello([]);
  aggiornaCarrello();
  disegna();

  // Elenca i capi che hanno raggiunto quantità 0.
  const esauriti = acquistati.filter((c) => disponibili(c) === 0).map((c) => c.nome);
  messaggio(
    `Acquisto simulato completato: ${carrello.length} ${carrello.length === 1 ? 'articolo' : 'articoli'}, ${euro(totale)}.` +
    (esauriti.length ? ` Ora non disponibile: ${esauriti.join(', ')}.` : '')
  );
});

// Svuota completamente il carrello salvato nel browser.
$('#cart-clear').addEventListener('click', () => {
  salvaCarrello([]);
  aggiornaCarrello();
});

// Rimuove dal carrello il singolo elemento corrispondente al pulsante cliccato.
$('#cart-list').addEventListener('click', (e) => {
  const b = e.target.closest('.rm');
  if (!b) return;

  const c = leggiCarrello();
  c.splice(+b.dataset.i, 1);
  salvaCarrello(c);
  aggiornaCarrello();
});

// Punto di ingresso dell'applicazione: avvia tutto il caricamento.
avvia();
