// Back-office Smart Tontine (chargé depuis un fichier : la CSP interdit les scripts en ligne).
const $ = (s, el = document) => el.querySelector(s);
const fcfa = (n) => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';
const int = (n) => new Intl.NumberFormat('fr-FR').format(n ?? 0);
const date = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEG = { nouveau: 'Nouveau', sans_depot: 'Sans dépôt', actif: 'Actif', epargnant: 'Épargnant', dormant: 'Dormant', vip: 'VIP' };
const TYPES = { deposit: 'Dépôt', withdrawal: 'Retrait', transfer: 'Transfert', ecaisse_lock: 'E-caisse', ecaisse_break: 'E-caisse cassée', ecaisse_release: 'E-caisse débloquée', cagnotte_contribution: 'Cagnotte', cagnotte_withdrawal: 'Retrait cagnotte', subscription: 'Smart Tontine+', referral_bonus: 'Parrainage', projet_contribution: 'Projet', challenge_saving: 'Challenge', contrat_repayment: 'Échéance contrat', contrat_disbursement: 'Prêt versé', reversal: 'Annulation', tontine_contribution: 'Cotisation tontine', tontine_payout: 'Pot tontine', tontine_guarantee: 'Caution tontine', tontine_guarantee_return: 'Caution rendue', loan_disbursement: 'Crédit versé', loan_repayment: 'Remboursement crédit' };
const PRODUCT = { avance_tontine: 'Avance sur tontine', microcredit: 'Microcrédit' };
const LOAN_STATUS = { active: 'En cours', repaid: 'Remboursé', defaulted: 'En défaut' };
const pct = (x) => x == null ? '—' : Math.round(x * 1000) / 10 + ' %';

let token = null;
try { token = localStorage.getItem('sf_admin_token'); } catch {}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) } });
  if (res.status === 401) { logout(); throw new Error('Session expirée'); }
  const body = res.status === 204 ? null : await res.json();
  if (res.status === 403 && (body?.error === 'mfa_required' || body?.error === 'mfa_setup_required')) { showMfa(body.error); throw new Error(body.message); }
  if (!res.ok) throw new Error(body?.message || 'Erreur');
  return body;
}

// ───── Double authentification (TOTP) ─────
async function showMfa(kind) {
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
  $('#codeBox').classList.add('hidden'); $('#mfaBox').classList.remove('hidden'); $('#mfaCode').value = ''; $('#loginMsg').textContent = '';
  $('#phone').classList.add('hidden'); $('#sendCode').classList.add('hidden');
  const setup = kind === 'mfa_setup_required' || kind === 'setup';
  $('#mfaSetup').classList.toggle('hidden', !setup);
  $('#mfaIntro').textContent = setup ? 'Activez la double authentification pour protéger le back-office.' : 'Saisissez le code de votre application d\'authentification.';
  if (setup) {
    const r = await api('/auth/mfa/setup', { method: 'POST', body: '{}' });
    $('#mfaSecret').textContent = r.secret.match(/.{1,4}/g).join(' ');
    $('#mfaLink').href = r.otpauthUrl;
  }
  $('#mfaBtn').onclick = async () => {
    try {
      const r = await api(setup ? '/auth/mfa/enable' : '/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code: $('#mfaCode').value.trim() }) });
      token = r.token; try { localStorage.setItem('sf_admin_token', token); } catch {}
      $('#mfaBox').classList.add('hidden'); $('#loginMsg').textContent = '';
      start();
    } catch (e) { $('#loginMsg').textContent = e.message; }
  };
}
async function afterLogin() {
  const me = await api('/auth/me');
  if (!['admin', 'support'].includes(me.role)) { token = null; throw new Error('Ce compte n\'a pas accès au back-office'); }
  try { localStorage.setItem('sf_admin_token', token); } catch {}
  const mfa = await api('/auth/mfa');
  if (mfa.enrolled && !mfa.verified) return showMfa('mfa_required');
  if (!mfa.enrolled && mfa.required) return showMfa('setup');
  $('#mfaHeader').classList.toggle('hidden', mfa.enrolled);
  start();
}
$('#mfaHeader').onclick = () => showMfa('setup');

// ───── Connexion ─────
$('#sendCode').onclick = async () => {
  try {
    const r = await api('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone: $('#phone').value.trim() }) });
    $('#codeBox').classList.remove('hidden');
    $('#loginMsg').textContent = r.devCode ? `Code (dev) : ${r.devCode}` : 'Code envoyé par SMS';
  } catch (e) { $('#loginMsg').textContent = e.message; }
};
$('#verify').onclick = async () => {
  try {
    const r = await api('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone: $('#phone').value.trim(), code: $('#code').value.trim() }) });
    token = r.token;
    await afterLogin();
  } catch (e) { $('#loginMsg').textContent = e.message; }
};
function logout() { $('#phone').classList.remove('hidden'); $('#sendCode').classList.remove('hidden'); $('#mfaBox').classList.add('hidden'); token = null; try { localStorage.removeItem('sf_admin_token'); } catch {} $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
$('#logoutBtn').onclick = logout;

// ───── Navigation ─────
const loaders = { kyc: loadKyc, dashboard: loadDashboard, microfinance: loadMicrofinance, partners: loadPartners, customers: loadCustomers, tickets: loadTickets, campaigns: loadCampaigns, finance: loadFinance };
$('#tabs').onclick = (e) => {
  const tab = e.target.dataset?.tab; if (!tab) return;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('[data-view]').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== tab));
  loaders[tab]();
};
function start() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); loadDashboard(); }

// ───── Tableau de bord ─────
const tile = (label, value, sub = '') => `<div class="card tile"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;

function barChart(el, rows, key, fmt) {
  const W = 720, H = 200, pad = { l: 8, r: 8, t: 12, b: 22 };
  const max = Math.max(1, ...rows.map((r) => r[key]));
  const bw = (W - pad.l - pad.r) / rows.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const bars = rows.map((r, i) => {
    const x = pad.l + i * bw + 1, w = Math.max(2, bw - 2), top = y(r[key]), h = H - pad.b - top;
    const path = h <= 0 ? '' : `M${x},${H - pad.b} V${top + Math.min(4, h)} q0,-4 4,-4 h${w - 8} q4,0 4,4 V${H - pad.b} Z`;
    return `<g data-i="${i}"><rect x="${pad.l + i * bw}" y="${pad.t}" width="${bw}" height="${H - pad.t - pad.b}" fill="transparent"/>${path ? `<path d="${path}" fill="var(--bar)"/>` : ''}</g>`;
  }).join('');
  const ticks = rows.map((r, i) => i % 7 === 0 ? `<text x="${pad.l + i * bw + bw / 2}" y="${H - 6}" font-size="10" fill="var(--muted)" text-anchor="middle">${r.day.slice(8)}/${r.day.slice(5, 7)}</text>` : '').join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${key} par jour">
    <line x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}" stroke="var(--line)"/>${bars}${ticks}</svg><div class="tip"></div>`;
  const tip = $('.tip', el), svg = $('svg', el);
  svg.addEventListener('mousemove', (e) => {
    const g = e.target.closest('g[data-i]');
    svg.querySelectorAll('path').forEach((p) => p.setAttribute('fill', 'var(--bar)'));
    if (!g) { tip.style.display = 'none'; return; }
    const r = rows[g.dataset.i]; const p = $('path', g); if (p) p.setAttribute('fill', 'var(--bar-hover)');
    const box = el.getBoundingClientRect();
    tip.style.display = 'block'; tip.style.left = (e.clientX - box.left) + 'px'; tip.style.top = (e.clientY - box.top) + 'px';
    tip.textContent = `${date(r.day)} · ${fmt(r[key])}`;
  });
  svg.addEventListener('mouseleave', () => { tip.style.display = 'none'; svg.querySelectorAll('path').forEach((p) => p.setAttribute('fill', 'var(--bar)')); });
}

function hbars(rows, label, value, fmt = int) {
  const max = Math.max(1, ...rows.map(value));
  return rows.map((r) => `<div class="hbar"><div>${esc(label(r))}</div><div class="track"><div class="fill" style="width:${(100 * value(r)) / max}%"></div></div><div class="v">${fmt(value(r))}</div></div>`).join('');
}

async function loadDashboard() {
  const k = await api('/admin/api/kpis');
  const conv = (a, b) => (b ? Math.round((100 * a) / b) : 0) + ' %';
  $('[data-view=dashboard]').innerHTML = `
    <div class="grid">
      ${tile('Clients', int(k.users.total), `+${int(k.users.new_7d)} cette semaine`)}
      ${tile('Actifs 30 j', int(k.users.mau), conv(k.users.mau, k.users.total) + ' des clients')}
      ${tile('Encours clients', fcfa(k.aum.total), fcfa(k.aum.locked_savings) + ' épargnés')}
      ${tile('Revenus 30 j', fcfa(k.revenue.last_30d), fcfa(k.revenue.total) + ' au total')}
      ${tile('Dépôts 30 j', fcfa(k.flows.deposits_30d), int(k.flows.deposits_count_30d) + ' dépôts')}
      ${tile('Smart Tontine+', int(k.users.plus_subscribers), 'abonnés payants')}
      ${tile('Organisateurs Pro', int(k.users.pro_subscribers), '2 000 F / mois')}
      ${tile('Tickets ouverts', int(k.tickets.open), 'support')}
    </div>
    <h2>Dépôts par jour — 30 derniers jours</h2>
    <div class="card chart" id="chartDeposits"></div>
    <h2>Inscriptions par jour — 30 derniers jours</h2>
    <div class="card chart" id="chartSignups"></div>
    <div class="two" style="margin-top:16px">
      <div class="card"><h3>Entonnoir d'activation</h3>${hbars([
        { l: 'Inscrits', v: k.funnel.signups }, { l: '1er dépôt', v: k.funnel.deposited },
        { l: 'Épargne active', v: k.funnel.saving }, { l: 'Abonnés Smart Tontine+', v: k.funnel.paying }], (r) => r.l, (r) => r.v)}</div>
      <div class="card"><h3>Segments</h3>${hbars(k.segments, (r) => SEG[r.segment] || r.segment, (r) => r.n)}</div>
      <div class="card"><h3>Canaux d'acquisition (inscrits → ayant déposé)</h3>
        <table><tr><th>Canal</th><th class="num">Inscrits</th><th class="num">Convertis</th><th class="num">Taux</th></tr>
        ${k.channels.map((c) => `<tr><td>${esc(c.channel)}</td><td class="num">${int(c.n)}</td><td class="num">${int(c.converted)}</td><td class="num">${conv(c.converted, c.n)}</td></tr>`).join('')}</table></div>
      <div class="card"><h3>Produits actifs</h3>${hbars([
        { l: 'E-caisses', v: k.products.ecaisses }, { l: 'Cagnottes+', v: k.products.cagnottes }, { l: 'Projets', v: k.products.projets },
        { l: 'Challenges', v: k.products.challenges }, { l: 'Contrats', v: k.products.contrats }], (r) => r.l, (r) => r.v)}</div>
    </div>`;
  barChart($('#chartDeposits'), k.daily, 'deposits', fcfa);
  barChart($('#chartSignups'), k.daily, 'signups', (v) => int(v) + ' inscrits');
}

// ───── Tontines & crédit ─────
async function loadMicrofinance() {
  const c = await api('/admin/api/credit');
  const p = c.portfolio, t = c.tontines;
  const par = p.outstanding ? p.par30 / p.outstanding : 0;
  $('[data-view=microfinance]').innerHTML = `
    <h2 style="margin-top:0">Tontines</h2>
    <div class="grid">
      ${tile('Tontines en cours', int(t.active), int(t.recruiting) + ' en recrutement · ' + int(t.completed) + ' terminées')}
      ${tile('Membres engagés', int(t.members))}
      ${tile('Cotisations collectées', fcfa(t.collected), int(t.contributions) + ' cotisations')}
      ${tile('Impayés couverts par caution', int(t.covered_defaults), pct(t.contributions ? t.covered_defaults / t.contributions : 0) + ' des cotisations')}
      ${tile('Cotisations en retard', int(t.late_contributions))}
    </div>
    ${c.overdueRounds.length ? `<div class="card" style="margin-top:12px"><h3>Tours échus non versés (clôture automatique après le délai de grâce)</h3><table>
      <tr><th>Tontine</th><th class="num">Tour</th><th>Échéance</th><th class="num">Cotisations manquantes</th></tr>
      ${c.overdueRounds.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.number}</td><td>${date(r.due_date)}</td><td class="num">${r.missing}</td></tr>`).join('')}</table></div>` : ''}
    <h2>Portefeuille de crédit</h2>
    <div class="grid">
      ${tile('Encours', fcfa(p.outstanding), int(p.active_loans) + ' crédits actifs')}
      ${tile('dont avances sur tontine', fcfa(p.outstanding_advances), 'remboursées sur le pot')}
      ${tile('PAR 30', pct(par), fcfa(p.par30) + ' à risque')}
      ${tile('En défaut', fcfa(p.defaulted), '> 90 jours de retard')}
      ${tile('Remboursement à l\'heure', pct(c.onTimeRate), 'échéances échues')}
      ${tile('Total décaissé', fcfa(c.totals.disbursed), int(c.totals.loans) + ' crédits · ' + int(c.totals.repaid) + ' remboursés')}
      ${tile('Intérêts reversés au SFD', fcfa(c.income.partner_interest))}
    </div>
    <p class="${par > 0.05 ? 'ko' : 'ok'}">${par > 0.05 ? '⚠ PAR 30 au-dessus du seuil de 5 % : durcir l\'octroi et renforcer le recouvrement.' : '✔ PAR 30 sous le seuil de 5 %.'}</p>
    <div class="card scroll"><h3>Crédits</h3><table>
      <tr><th>Client</th><th>Produit</th><th>Objet</th><th class="num">Montant</th><th class="num">Reste dû</th><th>Prochaine échéance</th><th class="num">Score</th><th>Statut</th></tr>
      ${c.loans.map((l) => `<tr><td><b>${esc(l.full_name || '—')}</b><br><span class="muted">${esc(l.phone)}</span></td><td>${PRODUCT[l.product]}</td><td>${esc(l.purpose)}</td>
        <td class="num">${fcfa(l.principal)}</td><td class="num">${fcfa(l.outstanding)}</td><td>${l.next_due ? date(l.next_due) : '—'}</td>
        <td class="num">${l.score_at_grant}</td><td><span class="pill">${LOAN_STATUS[l.status]}</span></td></tr>`).join('') || '<tr><td colspan="8" class="muted">Aucun crédit.</td></tr>'}
    </table></div>`;
}

// ───── Partenaires (validation KYB) ─────
const PTYPE = { association: 'Association / GIE', commercant: 'Commerçant', entreprise: 'Entreprise', tontinier: 'Tontinier pro', sfd: 'SFD', autre: 'Autre' };
const PSTATUS = { pending: '⏳ À valider', active: '✅ Actif', suspended: '⛔ Suspendu' };
async function loadPartners() {
  const rows = await api('/admin/api/partners');
  $('[data-view=partners]').innerHTML = `<div class="card scroll"><h3>Espaces partenaires (${rows.length})</h3>
    <p class="muted">Vérifier l'identité du responsable et l'existence de la structure (récépissé d'association, RCCM, agrément SFD) avant de valider.</p>
    <table><tr><th>Partenaire</th><th>Type</th><th>Responsable</th><th class="num">Tontines</th><th class="num">Coffres</th><th class="num">Biens</th><th class="num">Compte</th><th>Statut</th><th></th></tr>
    ${rows.map((p) => `<tr><td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${esc(p.primary_color)}"></span>
        ${p.logo ? `<img src="${esc(p.logo)}" alt="" style="width:24px;height:24px;border-radius:4px;vertical-align:middle">` : ''} <b>${esc(p.name)}</b><br><span class="muted">${esc(p.city || '')}</span></td>
      <td>${PTYPE[p.type] || p.type}</td><td>${esc(p.owner || '')}<br><span class="muted">${esc(p.owner_phone)}</span></td>
      <td class="num">${p.tontines}</td><td class="num">${p.coffres}</td><td class="num">${p.goods}</td><td class="num">${fcfa(p.balance)}${p.due_invoices ? `<br><span class="ko">${p.due_invoices} facture(s) due(s)</span>` : ''}</td>
      <td>${PSTATUS[p.status]}</td>
      <td>${p.status !== 'active' ? `<button class="btn" data-pact="${p.id}" data-status="active">Valider</button>` : `<button class="btn secondary" data-pact="${p.id}" data-status="suspended">Suspendre</button>`}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">Aucun partenaire.</td></tr>'}
    </table></div>`;
  document.querySelectorAll('[data-pact]').forEach((b) => b.onclick = async () => {
    await api('/admin/api/partners/' + b.dataset.pact, { method: 'PATCH', body: JSON.stringify({ status: b.dataset.status }) });
    loadPartners();
  });
  // Demandes reçues depuis le site public (« Devenir partenaire / SFD », contact).
  const leads = await api('/admin/api/leads');
  const LKIND = { partenaire: 'Partenaire', sfd: 'SFD', contact: 'Contact' };
  const LSTATUS = { new: 'Nouvelle', contacted: 'Contactée', won: 'Signée', lost: 'Perdue' };
  const box = document.createElement('div');
  box.className = 'card scroll';
  box.innerHTML = `<h3>Demandes reçues du site (${leads.filter((l) => l.status === 'new').length} nouvelles)</h3>
    <table><tr><th>Date</th><th>Type</th><th>Contact</th><th>Organisation</th><th class="num">Membres</th><th>Message</th><th>Statut</th></tr>
    ${leads.map((l) => `<tr><td>${date(l.created_at)}</td><td>${LKIND[l.kind]}</td><td><b>${esc(l.name)}</b><br><span class="muted">${esc(l.phone)}${l.email ? ' · ' + esc(l.email) : ''}</span></td>
      <td>${esc(l.organization || '')}<br><span class="muted">${esc(PTYPE[l.partner_type] || '')} ${esc(l.city || '')}</span></td><td class="num">${l.members ?? ''}</td>
      <td>${esc(l.message || '')}</td>
      <td><select data-lead="${l.id}">${Object.entries(LSTATUS).map(([k, v]) => `<option value="${k}" ${k === l.status ? 'selected' : ''}>${v}</option>`).join('')}</select>${l.handler ? `<br><span class="muted">${esc(l.handler)}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Aucune demande.</td></tr>'}
    </table>`;
  box.style.marginTop = '16px';
  $('[data-view=partners]').appendChild(box);
  box.querySelectorAll('[data-lead]').forEach((sel) => sel.onchange = async () => {
    await api('/admin/api/leads/' + sel.dataset.lead, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
    loadPartners();
  });
}

// ───── Vérification d'identité (KYC) ─────
const IDTYPE = { cnib: 'CNIB', passeport: 'Passeport', carte_consulaire: 'Carte consulaire', permis: 'Permis', carte_electeur: 'Carte d\'électeur', autre: 'Autre' };
$('#kycStatus').onchange = loadKyc;
async function loadKyc() {
  const status = $('#kycStatus').value;
  const rows = await api('/admin/api/kyc?status=' + status);
  $('#kycList').innerHTML = `<h3>Dossiers ${$('#kycStatus').selectedOptions[0].text.toLowerCase()} (${rows.length})</h3>
    <table><tr><th>Reçu le</th><th>Membre</th><th>Nom sur la pièce</th><th>Pièce</th><th>Niveau demandé</th><th>Niveau actuel</th><th></th></tr>
    ${rows.map((k) => `<tr><td>${date(k.created_at)}</td><td><b>${esc(k.account_name || '')}</b><br><span class="muted">${esc(k.phone)}</span></td>
      <td>${esc(k.full_name)}${k.birth_date ? `<br><span class="muted">né(e) le ${date(k.birth_date)}</span>` : ''}</td><td>${IDTYPE[k.id_type]}<br><span class="muted">${esc(k.id_number)}</span></td>
      <td class="num">${k.level}</td><td class="num">${k.kyc_level}</td>
      <td>${status === 'pending' ? `<button class="btn" data-kyc="${k.id}">Examiner</button>` : `${esc(k.reviewer || '')}${k.reason ? `<br><span class="muted">${esc(k.reason)}</span>` : ''}`}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Aucun dossier.</td></tr>'}
    </table>`;
  document.querySelectorAll('[data-kyc]').forEach((b) => b.onclick = () => openKyc(b.dataset.kyc));
}
async function openKyc(id) {
  const k = await api('/admin/api/kyc/' + id);
  const img = (label, src) => src ? `<figure style="margin:0"><figcaption class="muted">${label}</figcaption><img src="${esc(src)}" alt="${label}" style="width:100%;border-radius:10px;border:1px solid var(--line)"></figure>` : '';
  $('#drawerBody').innerHTML = `<h2>Dossier KYC niveau ${k.level} — ${esc(k.full_name)}</h2>
    <p class="muted">${esc(k.phone)} · compte « ${esc(k.account_name || '')} » · ${IDTYPE[k.id_type]} n° ${esc(k.id_number)}${k.birth_date ? ' · né(e) le ' + date(k.birth_date) : ''}</p>
    <p>Contrôler : nom identique au compte, pièce lisible et non expirée, visage du selfie identique à la photo de la pièce${k.level === 2 ? ', justificatif récent (moins de 3 mois) au même nom' : ''}.</p>
    <div class="two">${img('Pièce — recto', k.id_front)}${img('Pièce — verso', k.id_back)}${img('Selfie avec la pièce', k.selfie)}${img('Justificatif', k.proof_of_address)}</div>
    <div class="row" style="margin-top:16px"><button class="btn" id="kycOk">Valider le niveau ${k.level}</button>
      <input id="kycReason" placeholder="Motif du refus (visible par le membre)" style="flex:1;min-width:220px"><button class="btn secondary" id="kycKo">Refuser</button></div>
    <p id="kycMsg" class="ko"></p>`;
  const decide = async (decision) => {
    try {
      await api(`/admin/api/kyc/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason: $('#kycReason').value.trim() || undefined }) });
      $('#drawer').close(); loadKyc();
    } catch (e) { $('#kycMsg').textContent = e.message; }
  };
  $('#kycOk').onclick = () => decide('approve');
  $('#kycKo').onclick = () => decide('reject');
  if (!$('#drawer').open) $('#drawer').showModal();
}

// ───── Clients ─────
let searchTimer;
$('#search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadCustomers, 300); };
$('#segment').onchange = loadCustomers;
async function loadCustomers() {
  const qs = new URLSearchParams({ search: $('#search').value, segment: $('#segment').value });
  [...qs.keys()].forEach((key) => { if (!qs.get(key)) qs.delete(key); });
  const r = await api('/admin/api/customers?' + qs);
  $('#customerList').innerHTML = `<p class="muted">${int(r.total)} client(s)</p><table>
    <tr><th>Client</th><th>Segment</th><th class="num">Portefeuille</th><th class="num">Épargne</th><th class="num">Revenu généré</th><th>Canal</th><th>Inscrit le</th></tr>
    ${r.rows.map((c) => `<tr class="click" data-id="${c.id}"><td><b>${esc(c.full_name || '—')}</b><br><span class="muted">${esc(c.phone)}</span></td>
      <td><span class="pill">${SEG[c.segment]}</span>${c.plan === 'plus' ? ' <span class="pill">+</span>' : ''}</td>
      <td class="num">${fcfa(c.wallet)}</td><td class="num">${fcfa(c.savings)}</td><td class="num">${fcfa(c.revenue)}</td>
      <td>${esc(c.acquisition_channel || '—')}</td><td>${date(c.created_at)}</td></tr>`).join('')}</table>`;
  document.querySelectorAll('#customerList tr[data-id]').forEach((tr) => tr.onclick = () => openCustomer(tr.dataset.id));
}

async function openCustomer(id) {
  const d = await api('/admin/api/customers/' + id);
  const c = d.customer;
  const list = (rows, fn) => rows.length ? rows.map(fn).join('') : '<p class="muted">Aucun</p>';
  $('#drawerBody').innerHTML = `
    <div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(c.full_name || c.phone)}</h2><button class="btn secondary" id="closeDrawer">Fermer</button></div>
    <p class="muted">${esc(c.phone)} · ${esc(c.email || 'pas d\'e-mail')} · KYC niveau ${c.kyc_level} · <span class="pill">${SEG[c.segment]}</span> · statut ${c.status} · ${c.referrals} filleul(s)</p>
    <div class="grid">${tile('Portefeuille', fcfa(c.wallet))}${tile('Épargne', fcfa(c.savings))}${tile('Dépôts cumulés', fcfa(c.deposits_total), int(c.deposits_count) + ' dépôts')}${tile('Revenu généré', fcfa(c.revenue))}</div>
    <div class="row" style="margin-top:12px">
      <select id="kyc"><option value="0">KYC 0</option><option value="1">KYC 1 (pièce d'identité)</option><option value="2">KYC 2 (complet)</option></select>
      <button class="btn secondary" id="saveKyc">Mettre à jour KYC</button>
      <button class="btn secondary" id="toggleStatus">${c.status === 'active' ? 'Suspendre' : 'Réactiver'}</button>
    </div>
    <div class="two">
      <div><h3>Notes CRM</h3>
        <div class="row"><input id="noteBody" placeholder="Ex. appelé, intéressé par Cagnotte+" style="flex:1"><button class="btn" id="addNote">Ajouter</button></div>
        ${list(d.notes, (n) => `<div class="note">${esc(n.body)}<br><span class="muted">${esc(n.author)} · ${date(n.created_at)}</span></div>`)}
      </div>
      <div><h3>Produits</h3>
        ${d.products.tontines.map((e) => `<div>🔄 Tontine « ${esc(e.name)} » — ${fcfa(e.contribution_amount)}/tour, position ${e.position ?? '—'}, ${e.member_status === 'defaulter' ? '<span class="ko">défaillant</span>' : 'à jour'}, caution ${e.guarantee_status}</div>`).join('')}
        ${list(d.products.ecaisses, (e) => `<div>🔒 E-caisse « ${esc(e.name)} » — ${fcfa(e.balance)} (${e.status}, ${date(e.unlock_at)})</div>`)}
        ${d.products.cagnottes.map((e) => `<div>👥 Cagnotte « ${esc(e.name)} » — ${e.role}, ${fcfa(e.balance)}</div>`).join('')}
        ${d.products.projets.map((e) => `<div>🎯 Projet « ${esc(e.name)} » — ${fcfa(e.balance)} / ${fcfa(e.target_amount)}</div>`).join('')}
        ${d.products.contrats.map((e) => `<div>📝 Contrat « ${esc(e.title)} » — ${e.kind}, ${fcfa(e.principal)}, ${e.status}</div>`).join('')}
      </div>
    </div>
    <div class="two" style="margin-top:12px">
      <div><h3>Score Smart Tontine : ${d.score.score} / 1000</h3>${d.score.factors.map((f) => `<div class="muted">${f.points > 0 ? '+' : ''}${f.points} · ${esc(f.label)}</div>`).join('')}</div>
      <div><h3>Crédits</h3>${list(d.loans, (l) => `<div>${PRODUCT[l.product]} — ${fcfa(l.principal)} · reste ${fcfa(l.outstanding)} · <span class="pill">${LOAN_STATUS[l.status]}</span></div>`)}</div>
    </div>
    <h3 style="margin-top:20px">Dernières transactions</h3>
    <div class="scroll"><table><tr><th>Date</th><th>Type</th><th>Statut</th><th class="num">Montant</th><th class="num">Frais</th></tr>
    ${d.transactions.map((t) => `<tr><td>${date(t.created_at)}</td><td>${TYPES[t.type] || t.type}</td><td>${t.status}</td><td class="num">${fcfa(t.amount)}</td><td class="num">${fcfa(t.fee)}</td></tr>`).join('')}</table></div>
    <h3 style="margin-top:20px">Parcours (événements)</h3>
    ${list(d.events, (e) => `<div class="muted">${date(e.created_at)} — ${esc(e.name)}</div>`)}`;
  $('#kyc').value = c.kyc_level;
  $('#closeDrawer').onclick = () => $('#drawer').close();
  $('#addNote').onclick = async () => { await api(`/admin/api/customers/${id}/notes`, { method: 'POST', body: JSON.stringify({ body: $('#noteBody').value }) }); openCustomer(id); };
  $('#saveKyc').onclick = async () => { await api(`/admin/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify({ kycLevel: Number($('#kyc').value) }) }); openCustomer(id); };
  $('#toggleStatus').onclick = async () => { await api(`/admin/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify({ status: c.status === 'active' ? 'suspended' : 'active' }) }); openCustomer(id); };
  if (!$('#drawer').open) $('#drawer').showModal();
}

// ───── Support ─────
$('#ticketStatus').onchange = loadTickets;
async function loadTickets() {
  const s = $('#ticketStatus').value;
  const rows = await api('/admin/api/tickets' + (s ? '?status=' + s : ''));
  $('#ticketList').innerHTML = rows.length ? rows.map((t) => `<div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between"><b>${esc(t.subject)}</b><span class="pill">${t.status}</span></div>
    <p class="muted">${esc(t.full_name)} · ${esc(t.phone)} · ${date(t.created_at)} · canal ${t.channel}</p>
    <div class="msg">${esc(t.body)}</div>${(t.messages || []).map((m) => `<div class="msg">${esc(m.body)}</div>`).join('')}
    <div class="row" style="margin-top:8px"><input placeholder="Réponse" style="flex:1" data-reply="${t.id}">
      <button class="btn" data-send="${t.id}" data-status="pending">Répondre</button>
      <button class="btn secondary" data-send="${t.id}" data-status="closed">Répondre et fermer</button></div></div>`).join('') : '<p class="muted">Aucun ticket.</p>';
  document.querySelectorAll('[data-send]').forEach((b) => b.onclick = async () => {
    const body = $(`[data-reply="${b.dataset.send}"]`).value.trim(); if (!body) return;
    await api(`/admin/api/tickets/${b.dataset.send}/reply`, { method: 'POST', body: JSON.stringify({ body, status: b.dataset.status }) });
    loadTickets();
  });
}

// ───── Campagnes ─────
$('#campaignForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const c = await api('/admin/api/campaigns', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    $('#campaignMsg').textContent = `Campagne envoyée à ${int(c.sent_count)} client(s).`;
    e.target.reset(); loadCampaigns();
  } catch (err) { $('#campaignMsg').textContent = err.message; }
};
async function loadCampaigns() {
  const rows = await api('/admin/api/campaigns');
  $('#campaignList').innerHTML = rows.length ? `<table><tr><th>Campagne</th><th>Segment</th><th>Canal</th><th class="num">Envois</th><th>Date</th></tr>
    ${rows.map((c) => `<tr><td>${esc(c.name)}</td><td>${SEG[c.segment] || c.segment}</td><td>${c.channel}</td><td class="num">${int(c.sent_count)}</td><td>${date(c.sent_at)}</td></tr>`).join('')}</table>` : '<p class="muted">Aucune campagne.</p>';
}

// ───── Finance ─────
async function loadFinance() {
  const [check, rec] = await Promise.all([api('/admin/api/ledger/check').catch((e) => ({ error: e.message })), api('/admin/api/withdrawals/to-reconcile')]);
  const LABEL = { SYS_FLOAT: 'Float opérateurs (miroir des fonds clients)', SYS_FEES: 'Revenus de frais', SYS_REWARDS: 'Budget récompenses & parrainage' };
  $('[data-view=finance]').innerHTML = `
    <div class="card"><h3>Contrôle du grand livre</h3>
      ${check.error ? `<p class="muted">${esc(check.error)}</p>` : `
      <p class="${check.balanced ? 'ok' : 'ko'}">${check.balanced ? '✔ Grand livre équilibré : chaque franc est tracé.' : '✖ Écart détecté — escalader immédiatement.'}</p>
      <table>${check.system.map((s) => `<tr><td>${LABEL[s.code] || s.code}</td><td class="num">${fcfa(s.balance)}</td></tr>`).join('')}</table>`}
    </div>
    <h2>Retraits à rapprocher</h2>
    <div class="card scroll">${rec.length ? `<table><tr><th>Référence</th><th>Client</th><th class="num">Montant</th><th>Statut opérateur</th><th></th></tr>
      ${rec.map((t) => `<tr><td>${esc(t.reference)}</td><td>${esc(t.phone)}</td><td class="num">${fcfa(t.amount)}</td><td>${esc(t.meta.payout)}</td>
      <td><button class="btn secondary" data-confirm="${t.id}">Confirmé</button> <button class="btn secondary" data-reverse="${t.id}">Rembourser</button></td></tr>`).join('')}</table>`
      : '<p class="muted">Aucun retrait en suspens.</p>'}</div>`;
  document.querySelectorAll('[data-confirm]').forEach((b) => b.onclick = async () => { await api(`/admin/api/withdrawals/${b.dataset.confirm}/confirm`, { method: 'POST' }); loadFinance(); });
  document.querySelectorAll('[data-reverse]').forEach((b) => b.onclick = async () => { if (confirm('Recréditer le client ?')) { await api(`/admin/api/withdrawals/${b.dataset.reverse}/reverse`, { method: 'POST' }); loadFinance(); } });
}

if (token) afterLogin().catch(() => {});
