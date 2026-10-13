"use strict";
/* Agenda de Pedidos — versão Android (Capacitor).
   Dados: Preferences (armazenamento nativo). Lembretes: LocalNotifications (notificações locais agendadas pelo Android). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "f" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const dow = s => parse(s).getDay();
const weekStart = s => addDays(s, -((dow(s) + 6) % 7));
const at = (s, t) => { const d = parse(s); const [h, m] = (t || "23:59").split(":").map(Number); d.setHours(h || 0, m || 0, 0, 0); return d; };
const WD = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const WDS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const MON = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const fmtTime = t => t ? t.replace(":", "h") : "";
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDM = s => { const d = parse(s); return `${d.getDate()} de ${MON[d.getMonth()]}`; };
const DEFAULT_MSG = "Olá! Estou entrando em contato para realizar o pedido programado de hoje.";
const HORIZON_DAYS = 35, MAX_SCHEDULED = 400, CHANNEL = "lembretes-pedidos", TEST_ID = 2000000000;

/* ---------- native bridge ---------- */
const Cap = window.Capacitor;
const isNative = !!(Cap && typeof Cap.isNativePlatform === "function" && Cap.isNativePlatform());
const plugin = name => { if (!isNative) return null; try { return Cap.registerPlugin ? Cap.registerPlugin(name) : (Cap.Plugins && Cap.Plugins[name]) || null; } catch { return (Cap.Plugins && Cap.Plugins[name]) || null; } };
const Prefs = plugin("Preferences"), LN = plugin("LocalNotifications"), AppP = plugin("App"), Launcher = plugin("AppLauncher"), Share = plugin("Share");

const IC = {
  today: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
  week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17.5h2M11 17.5h2"/>',
  store: '<path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
  gear: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19.5 7"/>',
  chat: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 10.5h6M9 13.5h4"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 6 6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4"/>',
  belloff: '<path d="M6 16v-5a6 6 0 0 1 9.5-4.9M18 11v5l2 2H8M10 21h4M3 3l18 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', ul: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>', alert: '<path d="M12 3.5 2.5 20h19zM12 10v4.5M12 17.2v.3"/>'
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ---------- state ---------- */
const S = { forn: {}, feitos: {}, config: {}, ready: false };
const UI = { tab: "today", weekOff: 0, selDay: null, q: "" };
const NS = { perm: "unknown", exact: "unknown", scheduled: 0, lastError: "" };

/* ---------- domain ---------- */
const waNumber = phone => { let d = String(phone || "").replace(/\D/g, ""); if (!d) return ""; if (d.startsWith("00")) d = d.slice(2); if (d.length <= 11) d = "55" + d.replace(/^0/, ""); return d; };
const waHref = (phone, text) => { const n = waNumber(phone); return n.length >= 12 ? `https://wa.me/${n}${text ? "?text=" + encodeURIComponent(text) : ""}` : ""; };
const fmtPhone = phone => { const n = waNumber(phone); if (!n) return ""; if (n.startsWith("55") && n.length >= 12) { const ddd = n.slice(2, 4), r = n.slice(4); return `+55 (${ddd}) ${r.length === 9 ? r.slice(0, 5) + "-" + r.slice(5) : r.slice(0, 4) + "-" + r.slice(4)}`; } return "+" + n; };
const normUrl = u => { u = (u || "").trim(); if (!u) return ""; return /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : "https://" + u; };
const safeUrl = u => /^https?:\/\/[^\s]+\.[^\s]+/i.test(u || "") ? u : "";
const list = () => Object.values(S.forn);
const byTime = (a, b) => (a.time || "99:99").localeCompare(b.time || "99:99") || a.name.localeCompare(b.name, "pt-BR");
const forDay = d => list().filter(f => (f.days || []).includes(dow(d))).sort(byTime);
const doneKey = (id, d) => `${id}_${d}`;
const isDone = (id, d) => !!S.feitos[doneKey(id, d)];
const daysText = days => { const s = ORDER.filter(x => (days || []).includes(x)); if (s.length === 7) return "Todos os dias"; if (s.join() === "1,2,3,4,5") return "Segunda a sexta"; return s.map(x => WDS[x]).join(", ") || "Nenhum dia"; };
const msgFor = f => (f.msg || S.config.msg || DEFAULT_MSG);
const dayNum = s => Math.round(parse(s).getTime() / 864e5);

/* ---------- storage (native Preferences, browser fallback) ---------- */
const KEY = "agenda-pedidos-v2";
async function loadData() {
  let raw = null;
  try { raw = Prefs ? (await Prefs.get({ key: KEY })).value : localStorage.getItem(KEY); } catch { raw = null; }
  try { const d = JSON.parse(raw || "{}"); S.forn = d.forn || {}; S.feitos = d.feitos || {}; S.config = d.config || {}; } catch {}
  let changed = false;
  for (const f of list()) if (!f.n) { f.n = nextN(); changed = true; }
  if (changed) await persist();
}
function nextN() { const n = (S.config.nextN || 1); S.config.nextN = n + 1; return n; }
function pruneDone() { const lim = addDays(today(), -120); for (const k of Object.keys(S.feitos)) if (k.slice(-10) < lim) delete S.feitos[k]; }
let saving = Promise.resolve();
function persist() {
  pruneDone();
  const raw = JSON.stringify({ forn: S.forn, feitos: S.feitos, config: S.config });
  saving = saving.then(async () => {
    try { if (Prefs) await Prefs.set({ key: KEY, value: raw }); else localStorage.setItem(KEY, raw); }
    catch { toast("Não foi possível salvar. Verifique o espaço do celular."); }
  });
  return saving;
}
function save() { persist(); scheduleSync(); }

/* ---------- notifications ---------- */
const notifId = (f, d) => (f.n * 1000) + (dayNum(d) % 1000);
function plannedNotifications(now = new Date()) {
  const out = [], t = today();
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = addDays(t, i);
    for (const f of forDay(d)) {
      if (f.remind === false || !f.time || isDone(f.id, d)) continue;
      const when = at(d, f.time); if (when.getTime() <= now.getTime() + 5000) continue;
      out.push({
        id: notifId(f, d), title: `Pedido de hoje: ${f.name}`,
        body: f.desc ? f.desc : "Hora de fazer o pedido. Toque para abrir.",
        largeBody: [f.desc, f.notes].filter(Boolean).join("\n") || undefined,
        schedule: { at: when, allowWhileIdle: true }, channelId: CHANNEL,
        actionTypeId: waHref(f.phone) ? "PEDIDO_WA" : "PEDIDO", group: "pedidos", autoCancel: true,
        extra: { fid: f.id, date: d }
      });
    }
  }
  return out.slice(0, MAX_SCHEDULED);
}
let syncT = null, syncing = Promise.resolve();
function scheduleSync() { clearTimeout(syncT); syncT = setTimeout(() => { syncing = syncing.then(syncNotifications); }, 400); }
async function syncNotifications() {
  if (!LN) return;
  try {
    const perm = await LN.checkPermissions(); NS.perm = perm.display;
    const pend = await LN.getPending();
    const ids = (pend.notifications || []).filter(n => n.id !== TEST_ID).map(n => ({ id: n.id }));
    if (ids.length) await LN.cancel({ notifications: ids });
    if (NS.perm !== "granted") { NS.scheduled = 0; return; }
    const list = plannedNotifications();
    for (let i = 0; i < list.length; i += 50) await LN.schedule({ notifications: list.slice(i, i + 50) });
    NS.scheduled = list.length; NS.lastError = "";
  } catch (e) { NS.lastError = String(e?.message || e); }
}
async function initNotifications() {
  if (!LN) return;
  try { await LN.createChannel({ id: CHANNEL, name: "Lembretes de pedidos", description: "Avisa no horário de fazer cada pedido", importance: 5, visibility: 1, vibration: true, lights: true }); } catch {}
  try {
    await LN.registerActionTypes({ types: [
      { id: "PEDIDO", actions: [{ id: "done", title: "Marcar como feito" }] },
      { id: "PEDIDO_WA", actions: [{ id: "done", title: "Marcar como feito" }, { id: "wa", title: "Abrir WhatsApp" }] }
    ] });
  } catch {}
  try {
    LN.addListener("localNotificationActionPerformed", ev => {
      const x = ev?.notification?.extra || {}; const f = S.forn[x.fid];
      if (ev.actionId === "done" && f && x.date) { setDone(f.id, x.date, true, true); toast(`${f.name}: marcado como feito.`); }
      else if (ev.actionId === "wa" && f) { openExternal(waHref(f.phone, msgFor(f))); }
      else { UI.tab = "today"; closeSheet(sheets.length); render(); }
    });
  } catch {}
  await refreshNotifState();
}
async function refreshNotifState() {
  if (!LN) return;
  try { NS.perm = (await LN.checkPermissions()).display; } catch {}
  try { if (LN.checkExactNotificationSetting) NS.exact = (await LN.checkExactNotificationSetting()).exact_alarm; } catch { NS.exact = "unknown"; }
}
async function askNotifPermission() {
  if (!LN) { toast("Notificações só funcionam no app instalado no celular."); return; }
  try { NS.perm = (await LN.requestPermissions()).display; } catch {}
  if (NS.perm !== "granted") toast("Sem permissão, o celular não avisa. Libere em Configurações > Apps > Agenda de Pedidos > Notificações.");
  await refreshNotifState(); scheduleSync(); render();
}
async function askExactAlarms() {
  if (!LN?.changeExactNotificationSetting) return;
  try { NS.exact = (await LN.changeExactNotificationSetting()).exact_alarm; } catch {}
  await refreshNotifState(); scheduleSync(); render();
}
async function testNotification() {
  if (!LN) { toast("Teste disponível só no app instalado."); return; }
  if (NS.perm !== "granted") await askNotifPermission();
  if (NS.perm !== "granted") return;
  try {
    await LN.schedule({ notifications: [{ id: TEST_ID, title: "Teste da Agenda de Pedidos", body: "Se você está vendo isto, os lembretes vão chegar.", schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true }, channelId: CHANNEL }] });
    toast("Notificação de teste em 10 segundos. Pode bloquear a tela.");
  } catch (e) { toast("Não foi possível agendar o teste: " + (e?.message || e)); }
}

/* ---------- external links ---------- */
async function openExternal(url) {
  if (!url) return;
  if (Launcher) { try { await Launcher.openUrl({ url }); return; } catch {} }
  window.open(url, "_blank");
}

/* ---------- actions ---------- */
function setDone(id, d, on, silent) {
  const k = doneKey(id, d);
  if (on) S.feitos[k] = { at: new Date().toISOString() }; else delete S.feitos[k];
  save(); render();
  if (!silent) { const f = S.forn[id]; toast(on ? `${f?.name || "Pedido"}: feito.` : `${f?.name || "Pedido"}: voltou para pendente.`, () => setDone(id, d, !on, true)); }
}

/* ---------- render ---------- */
const TABS = [["today", "Hoje", "today"], ["week", "Minha semana", "week"], ["forn", "Fornecedores", "store"]];
function render() {
  $("#nav").innerHTML = TABS.map(([k, l, ic]) => `<button class="tab" data-act="tab" data-v="${k}" ${UI.tab === k ? 'aria-current="page"' : ""}>${icon(ic)}<span>${l}</span></button>`).join("");
  $("#title").textContent = { today: "Hoje", week: "Minha semana", forn: "Fornecedores" }[UI.tab];
  $("#gear").innerHTML = icon("gear");
  if (!S.ready) return;
  const fab = $("#fab"); fab.hidden = false; fab.innerHTML = icon("plus") + "<span>Novo fornecedor</span>";
  const main = $("#main"), changed = main.dataset.tab !== UI.tab;
  main.innerHTML = `<div class="${changed ? "view" : ""}">${VIEWS[UI.tab]()}</div>`;
  main.dataset.tab = UI.tab;
  paintSheets();
}
function notifBanner() {
  if (!isNative || !list().some(f => f.remind !== false && f.time)) return "";
  if (NS.perm !== "granted") return `<div class="banner warn" style="margin-bottom:12px">${icon("bell")}<div style="flex:1"><b>Ative as notificações</b><span class="small">Sem isso o celular não avisa na hora dos pedidos.</span><div style="margin-top:10px"><button class="btn sm primary" data-act="perm">Permitir notificações</button></div></div></div>`;
  if (NS.exact === "denied") return `<div class="banner warn" style="margin-bottom:12px">${icon("clock")}<div style="flex:1"><b>Avisos podem atrasar alguns minutos</b><span class="small">Permita “alarmes e lembretes” para o aviso tocar no horário exato.</span><div style="margin-top:10px"><button class="btn sm primary" data-act="exact">Permitir horário exato</button></div></div></div>`;
  return "";
}
function orderCard(f, d) {
  const done = isDone(f.id, d), past = !done && f.time && d === today() && new Date() > at(d, f.time);
  const s = done ? "s-done" : past ? "s-late" : "s-pend";
  const wa = waHref(f.phone), lk = safeUrl(f.link), doneAt = done ? new Date(S.feitos[doneKey(f.id, d)].at) : null;
  return `<article class="oc ${s}" data-id="${f.id}">
    <div class="oc-top"><h3>${esc(f.name)}</h3><span class="pill">${done ? "Feito" : past ? "Passou do horário" : "Pendente"}</span></div>
    ${f.desc ? `<p class="oc-desc">${esc(f.desc)}</p>` : ""}
    <div class="meta">${f.time ? `<span class="tag">${icon(f.remind !== false ? "bell" : "belloff")}${f.remind !== false ? "Lembrete às" : "Horário"} ${fmtTime(f.time)}</span>` : `<span class="tag">${icon("clock")}Sem horário</span>`}${f.notes ? `<span class="tag" style="white-space:normal">${esc(f.notes)}</span>` : ""}</div>
    ${wa || lk ? `<div class="actions">${wa ? `<button class="btn wa" data-act="wa" data-id="${f.id}">${icon("chat")}Abrir WhatsApp</button>` : ""}${lk ? `<button class="btn" data-act="open" data-url="${esc(lk)}">${icon("ext")}${esc(f.linkLabel || "Abrir link")}</button>` : ""}</div>` : ""}
    <button class="donebtn ${done ? "on" : ""}" data-act="done" data-id="${f.id}" data-d="${d}" aria-pressed="${done}">
      <span class="box">${done ? icon("check") : ""}</span>${done ? `Feito às ${pad(doneAt.getHours())}h${pad(doneAt.getMinutes())} <span class="undo">Desfazer</span>` : "Marcar como feito"}</button>
  </article>`;
}
function dayRow(f, d) {
  const done = isDone(f.id, d), wa = waHref(f.phone), lk = safeUrl(f.link);
  return `<div class="row ${done ? "done" : ""}">
    <button class="chk ${done ? "on" : ""}" data-act="done" data-id="${f.id}" data-d="${d}" aria-pressed="${done}" aria-label="${done ? "Desfazer" : "Marcar como feito"}: ${esc(f.name)}">${done ? icon("check") : ""}</button>
    <button class="main" data-act="edit" data-id="${f.id}"><span class="t">${esc(f.name)}</span><span class="s">${f.time ? fmtTime(f.time) + " · " : ""}${esc(f.desc || "Sem descrição")}</span></button>
    ${wa ? `<button class="ib wa" data-act="wa" data-id="${f.id}" aria-label="Abrir WhatsApp de ${esc(f.name)}">${icon("chat")}</button>` : ""}
    ${lk ? `<button class="ib lk" data-act="open" data-url="${esc(lk)}" aria-label="Abrir link de ${esc(f.name)}">${icon("ext")}</button>` : ""}</div>`;
}
const VIEWS = {
  today() {
    const t = today(), items = forDay(t), pend = items.filter(f => !isDone(f.id, t)), done = items.filter(f => isDone(f.id, t));
    const pct = items.length ? Math.round(done.length / items.length * 100) : 0;
    let html = `<section class="today-h"><div class="eyebrow">Pedidos de hoje · ${fmtDM(t)}</div><div class="day">${cap(WD[dow(t)])}</div>
      ${items.length ? `<div class="prog"><div class="bar" role="img" aria-label="${done.length} de ${items.length} pedidos feitos"><span style="width:${pct}%"></span></div><b>${done.length} de ${items.length} feitos</b></div>` : ""}</section>`;
    html += notifBanner();
    if (!list().length) html += `<div class="empty"><b>Cadastre seu primeiro fornecedor</b>Escolha os dias da semana em que você faz o pedido e o horário do lembrete. Ele vai aparecer aqui nesses dias.<br><button class="btn primary" data-act="new">${icon("plus")}Novo fornecedor</button></div>`;
    else if (!items.length) html += `<div class="empty"><b>Nenhum pedido previsto para hoje</b>Aproveite o dia. Veja abaixo o que vem nos próximos dias.</div>`;
    else if (!pend.length) html += `<div class="banner ok" style="margin-bottom:10px">${icon("check")}<div><b>Tudo feito por hoje</b><span class="small">Todos os pedidos de hoje foram marcados como feitos.</span></div></div>`;
    html += `<div class="stack">${[...pend, ...done].map(f => orderCard(f, t)).join("")}</div>`;
    if (list().length) {
      const next = [1, 2, 3, 4, 5, 6].map(i => addDays(t, i)).map(d => [d, forDay(d)]).filter(([, l]) => l.length).slice(0, 4);
      html += `<div class="sec-head"><h2 class="sec">Próximos dias</h2></div><div class="stack">${next.length ? next.map(([d, l]) => `<button class="up" data-act="goday" data-v="${d}"><span class="d"><b>${d === addDays(t, 1) ? "Amanhã" : WDS[dow(d)]}</b><span>${pad(parse(d).getDate())}/${pad(parse(d).getMonth() + 1)}</span></span><span class="names">${l.map(f => `<span class="nm ${isDone(f.id, d) ? "done" : ""}">${esc(f.name)}${f.time ? " · " + fmtTime(f.time) : ""}</span>`).join("")}</span></button>`).join("") : `<div class="empty" style="padding:14px">Nenhum pedido nos próximos 6 dias.</div>`}</div>`;
    }
    return html;
  },
  week() {
    const ws = addDays(weekStart(today()), UI.weekOff * 7), we = addDays(ws, 6);
    const sel = UI.selDay && UI.selDay >= ws && UI.selDay <= we ? UI.selDay : (UI.weekOff === 0 ? today() : ws);
    UI.selDay = sel;
    const label = UI.weekOff === 0 ? "Esta semana" : UI.weekOff === 1 ? "Próxima semana" : UI.weekOff === -1 ? "Semana passada" : UI.weekOff > 1 ? `Daqui a ${UI.weekOff} semanas` : `Há ${-UI.weekOff} semanas`;
    const a = parse(ws), b = parse(we);
    const days = [...Array(7)].map((_, i) => addDays(ws, i));
    const tiles = days.map(d => { const l = forDay(d), dn = l.filter(f => isDone(f.id, d)).length;
      return `<button class="wd ${d === today() ? "is-today" : ""}" data-act="selday" data-v="${d}" data-n="${l.length}" aria-pressed="${d === sel}" aria-label="${WD[dow(d)]}, ${l.length} fornecedores, ${dn} feitos"><span class="a">${WDS[dow(d)]}</span><span class="n">${parse(d).getDate()}</span><span class="c ${l.length ? "has" : ""}">${l.length ? dn + "/" + l.length : "–"}</span><span class="mb"><span style="width:${l.length ? dn / l.length * 100 : 0}%"></span></span></button>`; }).join("");
    const sl = forDay(sel);
    return `<div class="wk-bar"><button class="iconbtn" data-act="wk" data-v="-1" aria-label="Semana anterior">${icon("left")}</button>
      <div class="wk-label"><b>${label}</b><span>${a.getDate()} ${MON[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MON[b.getMonth()].slice(0, 3)}</span></div>
      <button class="iconbtn" data-act="wk" data-v="1" aria-label="Próxima semana">${icon("right")}</button></div>
      ${UI.weekOff !== 0 ? `<div style="text-align:center;margin:-4px 0 10px"><button class="btn sm" data-act="wk" data-v="0">Voltar para esta semana</button></div>` : ""}
      <div class="week">${tiles}</div>
      <div class="sec-head"><h2 class="sec">${cap(WD[dow(sel)])}${sel === today() ? " · hoje" : ""}</h2><span class="muted small">${fmtDM(sel)}</span></div>
      <div class="stack">${sl.length ? sl.map(f => dayRow(f, sel)).join("") : `<div class="empty"><b>Nenhum pedido neste dia</b>Nenhum fornecedor tem ${WD[dow(sel)]} marcado.</div>`}</div>
      <div class="sec-head"><h2 class="sec">Semana completa</h2></div>
      <div class="sum">${days.map(d => { const l = forDay(d); return `<button class="sum-r ${d === today() ? "is-today" : ""}" data-act="selday" data-v="${d}"><span class="d">${WD[dow(d)].replace("-feira", "")}<br><span class="mono" style="font-weight:500">${pad(parse(d).getDate())}/${pad(parse(d).getMonth() + 1)}</span></span><span class="names">${l.length ? l.map(f => `<span class="nm ${isDone(f.id, d) ? "done" : ""}">${esc(f.name)}</span>`).join("") : `<span class="none">Sem pedidos</span>`}</span></button>`; }).join("")}</div>`;
  },
  forn() {
    const q = UI.q.trim().toLowerCase();
    const l = list().filter(f => !q || [f.name, f.desc, f.notes].join(" ").toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return `${list().length > 3 || q ? `<label class="search">${icon("search")}<input id="q" type="search" placeholder="Buscar fornecedor" value="${esc(UI.q)}" data-input="q"></label>` : `<div style="height:6px"></div>`}
      <div class="stack">${l.length ? l.map(f => {
        const wa = waHref(f.phone), lk = safeUrl(f.link);
        return `<article class="sc" data-id="${f.id}"><button class="sc-top" data-act="edit" data-id="${f.id}"><span class="avatar">${esc((f.name || "?").trim().charAt(0).toUpperCase())}</span><span class="main"><span class="t">${esc(f.name)}</span><span class="s">${esc(f.desc || "Sem descrição")}</span></span>${icon("edit")}</button>
          <div class="dpills" aria-label="Dias: ${daysText(f.days)}">${ORDER.map(x => `<span class="${(f.days || []).includes(x) ? "on" : ""}">${WDS[x]}</span>`).join("")}</div>
          <div class="sc-foot"><label class="switch"><input type="checkbox" data-change="remind" data-id="${f.id}" ${f.remind !== false ? "checked" : ""} aria-label="Lembretes de ${esc(f.name)}">${f.remind !== false ? `Lembrete ${f.time ? "às " + fmtTime(f.time) : "sem horário"}` : "Lembrete desligado"}</label><span class="grow"></span>
          ${wa ? `<button class="ib wa" data-act="wa" data-id="${f.id}" aria-label="WhatsApp de ${esc(f.name)}">${icon("chat")}</button>` : ""}${lk ? `<button class="ib lk" data-act="open" data-url="${esc(lk)}" aria-label="Link do pedido de ${esc(f.name)}">${icon("ext")}</button>` : ""}</div></article>`;
      }).join("") : list().length ? `<div class="empty">Nenhum fornecedor encontrado.</div>` : `<div class="empty"><b>Nenhum fornecedor ainda</b>Toque em “Novo fornecedor” para cadastrar.</div>`}</div>`;
  }
};

/* ---------- sheets ---------- */
const sheets = []; let sid = 0;
function openSheet(spec) { spec.id = ++sid; sheets.push(spec); document.body.classList.add("locked"); paintSheets(); }
function closeSheet(n = 1) { for (let i = 0; i < n; i++) sheets.pop(); if (!sheets.length) document.body.classList.remove("locked"); paintSheets(); }
function paintSheets() {
  const root = $("#sheets"), ids = new Set(sheets.map(s => String(s.id)));
  $$(".sheet-wrap", root).forEach(w => { if (!ids.has(w.dataset.sid)) w.remove(); });
  sheets.forEach((s, i) => {
    let w = root.querySelector(`.sheet-wrap[data-sid="${s.id}"]`);
    if (!w) {
      w = document.createElement("div"); w.className = "sheet-wrap"; w.dataset.sid = s.id;
      w.innerHTML = `<div class="sheet-bd" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(s.title)}"><div class="sheet-h"><h2>${esc(s.title)}</h2><button class="iconbtn" data-act="close" aria-label="Fechar">${icon("x")}</button></div><div class="sheet-body">${s.render()}</div></div>`;
      root.appendChild(w); s.mount && s.mount(w);
    } else if (!s.static) { const b = w.querySelector(".sheet-body"), st = b.scrollTop; b.innerHTML = s.render(); b.scrollTop = st; }
    w.style.zIndex = 50 + i;
  });
}
function confirmSheet(title, text, okLabel, onOk) {
  openSheet({ title, static: true, render: () => `<p style="margin:0">${text}</p><div style="display:flex;gap:8px"><button class="btn" style="flex:1" data-act="close">Voltar</button><button class="btn danger" style="flex:1" id="cf_ok">${okLabel}</button></div>`,
    mount(w) { $("#cf_ok", w).onclick = onOk; } });
}

function waSheet(id) {
  const f = S.forn[id]; if (!f || !waHref(f.phone)) return;
  openSheet({ title: "WhatsApp · " + f.name, static: true,
    render: () => `<div class="hint">Para <b class="mono">${fmtPhone(f.phone)}</b></div>
      <div class="field"><label for="wa_msg">Mensagem (edite antes de abrir)</label><textarea class="inp msg" id="wa_msg">${esc(msgFor(f))}</textarea></div>
      <button class="btn wa block" id="wa_go">${icon("chat")}Abrir conversa com esta mensagem</button>
      <div style="display:flex;gap:8px"><button class="btn" id="wa_plain" style="flex:1">Abrir sem mensagem</button><button class="btn" style="flex:1" id="wa_copy">${icon("copy")}Copiar texto</button></div>
      <p class="hint" style="margin:0">O WhatsApp abre com o texto pronto. A mensagem só é enviada quando você tocar em enviar lá dentro.</p>`,
    mount(w) {
      const ta = $("#wa_msg", w);
      $("#wa_go", w).onclick = () => openExternal(waHref(f.phone, ta.value.trim()));
      $("#wa_plain", w).onclick = () => openExternal(waHref(f.phone));
      $("#wa_copy", w).onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast("Texto copiado."); } catch { ta.focus(); ta.select(); toast("Texto selecionado. Copie pelo teclado."); } };
    } });
}

function supplierForm(id) {
  const f = id ? S.forn[id] : { name: "", desc: "", days: [], time: "08:00", remind: true, phone: "", link: "", linkLabel: "", msg: "", notes: "" };
  if (!f) return;
  openSheet({ title: id ? "Editar fornecedor" : "Novo fornecedor", static: true,
    render: () => `<form id="fForm" class="stack" style="gap:16px" novalidate>
      <div class="field"><label for="f_name">Nome do fornecedor *</label><input class="inp" id="f_name" value="${esc(f.name)}" placeholder="Ex.: Fornecedor de frutas" autocomplete="off"></div>
      <div class="field"><label for="f_desc">O que pedir</label><textarea class="inp" id="f_desc" rows="2" placeholder="Ex.: frutas e verduras da semana">${esc(f.desc || "")}</textarea></div>
      <div class="field"><span class="flabel" id="dl">Dias da semana para fazer o pedido *</span>
        <div class="days" role="group" aria-labelledby="dl">${ORDER.map(x => `<label><input type="checkbox" name="f_days" value="${x}" ${(f.days || []).includes(x) ? "checked" : ""} aria-label="${WD[x]}"><span>${WDS[x]}</span></label>`).join("")}</div>
        <div class="quick"><button type="button" data-q="1,2,3,4,5">Seg a sex</button><button type="button" data-q="1,3,5">Seg, qua, sex</button><button type="button" data-q="2,4">Ter e qui</button><button type="button" data-q="0,1,2,3,4,5,6">Todos</button><button type="button" data-q="">Limpar</button></div></div>
      <label class="toggle"><span class="switch" style="min-height:0"><input type="checkbox" id="f_remind" ${f.remind !== false ? "checked" : ""}></span><span class="grow">Lembrete</span><input type="time" id="f_time" value="${esc(f.time || "")}" aria-label="Horário do lembrete"></label>
      <div class="preview" id="f_prev"></div>
      <div class="field"><label for="f_phone">WhatsApp (com DDD)</label><input class="inp" id="f_phone" inputmode="tel" value="${esc(f.phone || "")}" placeholder="+55 15 99999-0000"><span class="hint" id="f_wa">Sem código do país, o app usa +55 (Brasil).</span></div>
      <div class="field"><label for="f_link">Link do site, catálogo ou portal de pedidos</label><input class="inp" id="f_link" type="url" inputmode="url" value="${esc(f.link || "")}" placeholder="https://"></div>
      <div class="field"><label for="f_ll">Nome do botão do link (opcional)</label><input class="inp" id="f_ll" value="${esc(f.linkLabel || "")}" placeholder="Abrir link"></div>
      <div class="field"><label for="f_msg">Mensagem pronta para o WhatsApp (opcional)</label><textarea class="inp" id="f_msg" rows="3" placeholder="${esc(S.config.msg || DEFAULT_MSG)}">${esc(f.msg || "")}</textarea><span class="hint">Em branco, usa a mensagem padrão (Ajustes).</span></div>
      <div class="field"><label for="f_notes">Observações</label><textarea class="inp" id="f_notes" rows="2" placeholder="Ex.: pedido mínimo de 3 caixas">${esc(f.notes || "")}</textarea></div>
      ${id ? `<button type="button" class="btn danger block" id="f_del">${icon("trash")}Excluir fornecedor</button>` : ""}
      <div class="form-actions"><button type="button" class="btn" data-act="close">Cancelar</button><button type="submit" class="btn primary" id="f_save">${icon("check")}Salvar</button></div></form>`,
    mount(w) {
      const form = $("#fForm", w);
      const days = () => $$('input[name="f_days"]', w).filter(x => x.checked).map(x => +x.value);
      const prev = () => {
        const d = days(), t = $("#f_time", w).value, r = $("#f_remind", w).checked;
        $("#f_prev", w).innerHTML = d.length ? `Aparece em <b>${daysText(d)}</b>, toda semana${t ? (r ? `, com notificação às <b>${fmtTime(t)}</b>` : `, às ${fmtTime(t)} (lembrete desligado)`) : ""}.` : `Selecione pelo menos um dia.`;
        const ph = $("#f_phone", w).value; $("#f_wa", w).textContent = ph.trim() ? (waHref(ph) ? `Link: wa.me/${waNumber(ph)} · ${fmtPhone(ph)}` : "Número incompleto. Inclua o DDD.") : "Sem código do país, o app usa +55 (Brasil).";
      };
      $$(".quick button", w).forEach(b => b.onclick = () => { const v = b.dataset.q ? b.dataset.q.split(",").map(Number) : []; $$('input[name="f_days"]', w).forEach(x => x.checked = v.includes(+x.value)); prev(); });
      form.addEventListener("input", prev); form.addEventListener("change", prev); prev();
      $("#f_del", w)?.addEventListener("click", () => confirmSheet("Excluir fornecedor", `Excluir <b>${esc(f.name)}</b>? Os lembretes dele deixam de tocar.`, "Excluir", () => {
        delete S.forn[id]; Object.keys(S.feitos).forEach(k => { if (k.startsWith(id + "_")) delete S.feitos[k]; }); save(); closeSheet(2); toast("Fornecedor excluído."); render(); }));
      form.addEventListener("submit", ev => {
        ev.preventDefault();
        const name = $("#f_name", w).value.trim(), d = days(), ph = $("#f_phone", w).value.trim();
        if (!name) { $("#f_name", w).focus(); toast("Informe o nome do fornecedor."); return; }
        if (!d.length) { $('input[name="f_days"]', w).focus(); toast("Selecione pelo menos um dia da semana."); return; }
        if (ph && !waHref(ph)) { $("#f_phone", w).focus(); toast("Número de WhatsApp incompleto. Inclua o DDD."); return; }
        const nid = id || uid(), old = id ? S.forn[id] : null;
        const nf = { ...(old || {}), id: nid, n: old?.n || nextN(), name, desc: $("#f_desc", w).value.trim(), days: ORDER.filter(x => d.includes(x)), time: $("#f_time", w).value, remind: $("#f_remind", w).checked,
          phone: ph, link: normUrl($("#f_link", w).value), linkLabel: $("#f_ll", w).value.trim(), msg: $("#f_msg", w).value.trim(), notes: $("#f_notes", w).value.trim(), createdAt: old?.createdAt || new Date().toISOString() };
        S.forn[nid] = nf; save(); closeSheet(); render();
        toast(id ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
        if (nf.remind && nf.time && isNative && NS.perm !== "granted") askNotifPermission();
      });
    } });
}

function settingsSheet() {
  refreshNotifState().then(() => paintSheets());
  openSheet({ title: "Ajustes", render() {
    const th = (() => { try { return localStorage.getItem("ap-theme") || "system"; } catch { return "system"; } })();
    const permTxt = !isNative ? "Abra o app instalado no celular para ativar." : NS.perm === "granted" ? "Permitidas" : "Bloqueadas";
    const exTxt = NS.exact === "granted" ? "No horário exato" : NS.exact === "denied" ? "Podem atrasar alguns minutos" : "Padrão do sistema";
    return `<div class="field"><span class="flabel">Notificações</span>
      <div class="sum">
        <div class="sum-r"><span class="d" style="width:110px">Permissão</span><span class="names"><b style="color:${NS.perm === "granted" ? "var(--done)" : "var(--late)"}">${permTxt}</b></span></div>
        <div class="sum-r"><span class="d" style="width:110px">Horário</span><span class="names">${exTxt}</span></div>
        <div class="sum-r"><span class="d" style="width:110px">Agendadas</span><span class="names">${NS.scheduled} avisos nos próximos ${HORIZON_DAYS} dias</span></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${NS.perm !== "granted" ? `<button class="btn primary" style="flex:1 1 140px" data-act="perm">${icon("bell")}Permitir notificações</button>` : ""}${NS.exact === "denied" ? `<button class="btn" style="flex:1 1 140px" data-act="exact">${icon("clock")}Permitir horário exato</button>` : ""}<button class="btn" style="flex:1 1 140px" data-act="test">${icon("bell")}Testar notificação</button></div>
      <p class="hint" style="margin:0">Alguns celulares (Xiaomi, Samsung, Motorola) economizam bateria fechando apps. Se um aviso não chegar, vá em Configurações › Apps › Agenda de Pedidos › Bateria e escolha <b>Sem restrições</b>.</p>
      ${NS.lastError ? `<p class="hint" style="margin:0;color:var(--late)">Erro ao agendar: ${esc(NS.lastError)}</p>` : ""}</div>
    <div class="field"><span class="flabel">Aparência</span><div class="seg">${[["system", "Automático"], ["light", "Claro"], ["dark", "Escuro"]].map(([k, l]) => `<button data-act="theme" data-v="${k}" aria-pressed="${th === k}">${l}</button>`).join("")}</div></div>
    <div class="field"><label for="cfg_msg">Mensagem padrão do WhatsApp</label><textarea class="inp" id="cfg_msg" rows="3" data-blur="cfgmsg">${esc(S.config.msg || DEFAULT_MSG)}</textarea></div>
    <div class="field"><span class="flabel">Backup</span><p class="small muted" style="margin:0">Os dados ficam salvos no celular. Exporte de vez em quando para não perder nada se trocar de aparelho.</p>
      <div style="display:flex;gap:8px"><button class="btn" style="flex:1" data-act="export">${icon("dl")}Exportar</button><button class="btn" style="flex:1" data-act="import">${icon("ul")}Importar</button></div></div>
    <button class="btn danger block" data-act="wipe">${icon("trash")}Apagar todos os dados</button>`;
  } });
}
function applyTheme() { let t = "system"; try { t = localStorage.getItem("ap-theme") || "system"; } catch {} if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t; }

/* in-app reminder while open */
let lastCheck = Date.now(); const shown = new Set();
function checkReminders() {
  if (!S.ready) return; const n = Date.now(), t = today();
  if (!isNative || NS.perm !== "granted") for (const f of forDay(t)) {
    if (f.remind === false || !f.time || isDone(f.id, t)) continue;
    const ms = at(t, f.time).getTime(), k = f.id + t;
    if (ms > lastCheck && ms <= n && !shown.has(k)) { shown.add(k); toast(`Hora de fazer o pedido: ${f.name}`, () => { UI.tab = "today"; closeSheet(sheets.length); render(); }, { label: "Ver", rem: true, ms: 20000 }); }
  }
  lastCheck = n;
  const a = document.activeElement; if (!sheets.length && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) render();
}

function toast(msg, action, opt = {}) {
  const el = document.createElement("div"); el.className = "toast" + (opt.rem ? " rem" : "");
  el.innerHTML = `${opt.rem ? icon("bell") : ""}<span class="grow">${esc(msg)}</span>${action ? `<button>${opt.label || "Desfazer"}</button>` : ""}`;
  if (action) el.querySelector("button").onclick = () => { el.remove(); action(); };
  const box = $("#toasts"); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), opt.ms || 4500);
}

/* backup */
async function exportBackup() {
  const data = JSON.stringify({ app: "agenda-de-pedidos", version: 2, exportedAt: new Date().toISOString(), forn: S.forn, feitos: S.feitos, config: S.config });
  if (Share) { try { await Share.share({ title: "Backup Agenda de Pedidos", text: data, dialogTitle: "Salvar backup (ex.: enviar para você no WhatsApp ou Drive)" }); return; } catch (e) { if (/cancel/i.test(String(e?.message || e))) return; } }
  try { await navigator.clipboard.writeText(data); toast("Backup copiado. Cole em uma conversa ou nota para guardar."); } catch { toast("Não foi possível exportar agora."); }
}
function importSheet() {
  openSheet({ title: "Importar backup", static: true,
    render: () => `<p class="small" style="margin:0">Cole abaixo o texto do backup (exportado deste app ou da versão web) ou escolha o arquivo .json.</p>
      <textarea class="inp msg" id="imp_txt" placeholder='{"app":"agenda-de-pedidos", ...}'></textarea>
      <div style="display:flex;gap:8px"><button class="btn" style="flex:1" id="imp_file">${icon("ul")}Escolher arquivo</button><button class="btn primary" style="flex:1" id="imp_go">Importar</button></div>`,
    mount(w) {
      $("#imp_file", w).onclick = () => $("#importFile").click();
      $("#imp_go", w).onclick = () => doImport($("#imp_txt", w).value);
    } });
}
function doImport(text) {
  let d; try { d = JSON.parse(text); } catch { toast("Texto inválido. Cole o backup completo."); return; }
  if (!d || typeof d.forn !== "object") { toast("Isto não é um backup da Agenda de Pedidos."); return; }
  confirmSheet("Substituir dados?", `O backup tem ${Object.keys(d.forn).length} fornecedores e vai <b>substituir</b> os dados atuais.`, "Substituir", () => {
    S.forn = d.forn; S.feitos = d.feitos || {}; S.config = { ...(d.config || {}), nextN: S.config.nextN || 1 };
    for (const f of list()) f.n = nextN();
    save(); closeSheet(sheets.length); toast("Backup importado."); render();
  });
}
$("#importFile").addEventListener("change", ev => { const file = ev.target.files[0]; ev.target.value = ""; if (!file) return; const rd = new FileReader(); rd.onload = () => doImport(rd.result); rd.readAsText(file); });

/* ---------- events ---------- */
document.addEventListener("click", ev => {
  const el = ev.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act, v = el.dataset.v, id = el.dataset.id;
  const H = {
    tab: () => { UI.tab = v; if (v === "week") { UI.weekOff = 0; UI.selDay = today(); } closeSheet(sheets.length); window.scrollTo({ top: 0 }); render(); },
    close: () => closeSheet(),
    done: () => setDone(id, el.dataset.d, !isDone(id, el.dataset.d)),
    wa: () => waSheet(id),
    open: () => openExternal(el.dataset.url),
    edit: () => supplierForm(id),
    new: () => supplierForm(null),
    selday: () => { UI.selDay = v; render(); },
    goday: () => { UI.tab = "week"; UI.weekOff = Math.round((parse(weekStart(v)) - parse(weekStart(today()))) / (7 * 864e5)); UI.selDay = v; window.scrollTo({ top: 0 }); render(); },
    wk: () => { UI.weekOff = v === "0" ? 0 : UI.weekOff + +v; UI.selDay = UI.weekOff === 0 ? today() : addDays(weekStart(today()), UI.weekOff * 7); render(); },
    settings: () => settingsSheet(),
    perm: () => askNotifPermission(),
    exact: () => askExactAlarms(),
    test: () => testNotification(),
    theme: () => { try { localStorage.setItem("ap-theme", v); } catch {} applyTheme(); paintSheets(); },
    export: () => exportBackup(),
    import: () => importSheet(),
    wipe: () => confirmSheet("Apagar todos os dados", "Remove todos os fornecedores e marcações. Não dá para desfazer.", "Apagar tudo", () => { S.forn = {}; S.feitos = {}; save(); closeSheet(sheets.length); toast("Dados apagados."); render(); })
  };
  if (H[a]) { ev.preventDefault(); H[a](); }
});
document.addEventListener("click", ev => { const l = ev.target.closest("a[href^='http']"); if (l && isNative) { ev.preventDefault(); openExternal(l.href); } });
document.addEventListener("input", ev => {
  const k = ev.target.dataset?.input; if (!k) return; UI[k] = ev.target.value;
  const pos = ev.target.selectionStart, idd = ev.target.id; render(); const n = document.getElementById(idd); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch {} }
});
document.addEventListener("change", ev => {
  const t = ev.target; if (t.dataset?.change !== "remind") return; const f = S.forn[t.dataset.id]; if (!f) return;
  f.remind = t.checked; save(); render(); toast(t.checked ? `Lembrete de ${f.name} ligado.` : `Lembrete de ${f.name} desligado.`);
});
document.addEventListener("focusout", ev => {
  const t = ev.target; if (t.dataset?.blur !== "cfgmsg") return; const v = t.value.trim();
  if (v && v !== (S.config.msg || DEFAULT_MSG)) setTimeout(() => { S.config.msg = v; save(); toast("Mensagem padrão salva."); }, 200);
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && sheets.length) closeSheet(); });

/* Android back button & resume */
if (AppP) {
  try {
    AppP.addListener("backButton", () => {
      if (sheets.length) closeSheet();
      else if (UI.tab !== "today") { UI.tab = "today"; render(); }
      else AppP.exitApp();
    });
    AppP.addListener("appStateChange", st => { if (st.isActive) { refreshNotifState().then(() => { scheduleSync(); render(); }); } });
  } catch {}
}

/* ---------- boot ---------- */
(async function boot() {
  applyTheme(); render();
  await loadData();
  S.ready = true; render();
  await initNotifications();
  scheduleSync(); render();
  setInterval(checkReminders, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkReminders(); });
})();
