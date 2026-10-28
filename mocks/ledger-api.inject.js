// Mountebank injection: a STATEFUL emulation of this project's own /api/v1 Ledger + Exchange Rates
// endpoints (F-2): currencies, wallets, transactions.
//
// Used in mock mode only — Stage 7 (Bruno, port 4545) and Stage 21/23 (Vite /api proxy → port 4545,
// Playwright). It must be able to fail exactly the way the real NestJS modules fail
// (.claude/rules/e2e-contract.md → Test-double fidelity): 415 non-JSON body, 401 without a valid
// Session (it reads the Sessions that mocks/identity-api.inject.js stores in the shared imposter
// state), the full 400 catalogue (one message per failing field, DTO property order), 400 before 404,
// and 404 "Wallet not found." for an unknown, foreign, or malformed Wallet id. Balances are derived on
// every read with BigInt — never stored.
//
// Source of truth for the contract: artifacts/F-2/01-requirements.md (endpoint rules + error catalogue)
// and artifacts/F-2/02-flow.md. Where this double and the real service disagree, the real service is
// right.
//
// mocks/build-imposters.mjs embeds this file as the `inject` of the stub matching
// ^/api/v1/(currencies|wallets) — placed before the Identity stub.
function (config) {
  var state = config.state;
  var req = config.request;

  var THIRTY_DAYS_S = 2592000;
  var MAX_MINOR = BigInt('999999999999999');
  var MSG = {
    notSignedIn: 'Not signed in.',
    walletName: 'Enter a wallet name.',
    walletNameLength: 'Wallet name must be at most 60 characters.',
    currency: 'Choose a supported currency.',
    openingBalance: 'Opening balance must be a whole number of minor units.',
    openingBalanceTooLarge: 'Opening balance is too large.',
    kind: 'Choose income or expense.',
    amount: 'Amount must be a whole number of minor units.',
    amountPositive: 'Amount must be greater than 0.',
    amountTooLarge: 'Amount is too large.',
    occurredOn: 'Enter a valid date.',
    futureDate: "Date can't be in the future.",
    note: 'Note must be at most 200 characters.',
    today: 'today must be a valid date (YYYY-MM-DD).',
    walletNotFound: 'Wallet not found.'
  };

  // Frankfurter's currency list, verified 2026-10-29 (artifacts/F-2/01-requirements.md), with ISO-4217
  // minor digits. Same snapshot as backend/src/rates — change both or neither.
  var CURRENCIES = [
    ['AUD', 'Australian Dollar', 2], ['BRL', 'Brazilian Real', 2], ['CAD', 'Canadian Dollar', 2],
    ['CHF', 'Swiss Franc', 2], ['CNY', 'Chinese Renminbi Yuan', 2], ['CZK', 'Czech Koruna', 2],
    ['DKK', 'Danish Krone', 2], ['EUR', 'Euro', 2], ['GBP', 'British Pound', 2],
    ['HKD', 'Hong Kong Dollar', 2], ['HUF', 'Hungarian Forint', 2], ['IDR', 'Indonesian Rupiah', 2],
    ['ILS', 'Israeli New Shekel', 2], ['INR', 'Indian Rupee', 2], ['ISK', 'Icelandic Króna', 0],
    ['JPY', 'Japanese Yen', 0], ['KRW', 'South Korean Won', 0], ['MXN', 'Mexican Peso', 2],
    ['MYR', 'Malaysian Ringgit', 2], ['NOK', 'Norwegian Krone', 2], ['NZD', 'New Zealand Dollar', 2],
    ['PHP', 'Philippine Peso', 2], ['PLN', 'Polish Złoty', 2], ['RON', 'Romanian Leu', 2],
    ['SEK', 'Swedish Krona', 2], ['SGD', 'Singapore Dollar', 2], ['THB', 'Thai Baht', 2],
    ['TRY', 'Turkish Lira', 2], ['USD', 'United States Dollar', 2], ['ZAR', 'South African Rand', 2]
  ];

  if (!state.wallets) {
    state.wallets = {};      // id -> { id, userId, name, currency, openingBalanceMinor, createdAt, updatedAt }
    state.transactions = []; // { id, walletId, kind, amountMinor, occurredOn, note, createdAt, updatedAt }
    state.lastMs = 0;
  }

  function randomHex(n) {
    var s = '';
    for (var i = 0; i < n; i++) { s += Math.floor(Math.random() * 16).toString(16); }
    return s;
  }
  function uuid() {
    var h = randomHex(32);
    var variant = '89ab'.charAt(Math.floor(Math.random() * 4));
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + variant + h.slice(17, 20) + '-' + h.slice(20, 32);
  }
  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
  // Strictly increasing timestamps, so "newest createdAt first" is deterministic within one process.
  function nowIso() {
    var ms = Math.max(Date.now(), state.lastMs + 1);
    state.lastMs = ms;
    return new Date(ms).toISOString();
  }
  function header(name) {
    var headers = req.headers || {};
    var lower = name.toLowerCase();
    for (var k in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, k) && k.toLowerCase() === lower) { return headers[k]; }
    }
    return undefined;
  }
  function sidFromCookie() {
    var cookie = header('cookie');
    if (!cookie) { return null; }
    var parts = String(cookie).split(';');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf('sid=') === 0) { return p.slice(4) || null; }
    }
    return null;
  }
  function hasBody() {
    return req.body !== undefined && req.body !== null && req.body !== '';
  }
  function respond(statusCode, payload, extraHeaders) {
    var headers = { 'Content-Type': 'application/json; charset=utf-8' };
    for (var k in (extraHeaders || {})) { headers[k] = extraHeaders[k]; }
    return { statusCode: statusCode, headers: headers, body: payload === undefined ? '' : JSON.stringify(payload) };
  }
  function error(statusCode, message, errorName, extraHeaders) {
    return respond(statusCode, { statusCode: statusCode, message: message, error: errorName }, extraHeaders);
  }
  // The real guard slides the Session and re-sends the cookie on every request it lets through.
  function sessionCookie(token) {
    return 'sid=' + token + '; Max-Age=' + THIRTY_DAYS_S + '; Path=/; HttpOnly; SameSite=Lax';
  }
  function signedIn() {
    var token = sidFromCookie();
    if (!token || !state.sessions) { return null; }
    var s = state.sessions[token];
    if (!s || s.expiresAt <= Date.now()) { return null; }
    s.expiresAt = Date.now() + THIRTY_DAYS_S * 1000;
    return { userId: s.userId, cookie: { 'Set-Cookie': sessionCookie(token) } };
  }
  function findCurrency(code) {
    if (typeof code !== 'string') { return null; }
    for (var i = 0; i < CURRENCIES.length; i++) {
      if (CURRENCIES[i][0] === code) { return CURRENCIES[i]; }
    }
    return null;
  }
  function isRealDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) { return false; }
    var y = Number(value.slice(0, 4));
    var m = Number(value.slice(5, 7));
    var d = Number(value.slice(8, 10));
    if (y < 1 || m < 1 || m > 12 || d < 1) { return false; }
    var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    return d <= days;
  }
  function absBig(v) { return v < BigInt(0) ? -v : v; }

  function walletBalance(wallet) {
    var balance = BigInt(wallet.openingBalanceMinor);
    for (var i = 0; i < state.transactions.length; i++) {
      var t = state.transactions[i];
      if (t.walletId !== wallet.id) { continue; }
      balance = t.kind === 'income' ? balance + BigInt(t.amountMinor) : balance - BigInt(t.amountMinor);
    }
    return balance.toString();
  }
  function walletJson(wallet) {
    return {
      id: wallet.id,
      name: wallet.name,
      currency: wallet.currency,
      openingBalanceMinor: wallet.openingBalanceMinor,
      balanceMinor: walletBalance(wallet),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    };
  }
  function transactionJson(t) {
    return {
      id: t.id,
      walletId: t.walletId,
      kind: t.kind,
      amountMinor: t.amountMinor,
      occurredOn: t.occurredOn,
      note: t.note,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    };
  }
  function desc(a, b) { return a < b ? 1 : (a > b ? -1 : 0); }
  function ownedWallet(userId, walletId) {
    if (!isUuid(walletId)) { return null; }
    var w = state.wallets[String(walletId).toLowerCase()];
    return w && w.userId === userId ? w : null;
  }

  var method = String(req.method || '').toUpperCase();
  var path = String(req.path || '').replace(/\/+$/, '') || '/';

  // 1. JSON-only bodies (backend/src/http-security.ts, requireJsonBody) — before everything else.
  if (hasBody()) {
    var contentType = header('content-type');
    if (!contentType || !/^application\/json\s*(;|$)/i.test(String(contentType).trim())) {
      return error(415, 'Content-Type must be application/json', 'Unsupported Media Type');
    }
  }
  var parsed = {};
  if (hasBody()) {
    if (typeof req.body === 'object') { parsed = req.body; } else {
      try { parsed = JSON.parse(req.body); } catch (e) { return error(400, 'Unexpected token in JSON body', 'Bad Request'); }
    }
  }
  if (parsed === null || typeof parsed !== 'object') { parsed = {}; }

  // 2. Route match (an unmatched route is Nest's 404 before any guard runs).
  var segments = path.split('/'); // ['', 'api', 'v1', 'wallets', ':id', 'transactions']
  var route = null;
  if (method === 'GET' && path === '/api/v1/currencies') { route = 'listCurrencies'; }
  else if (method === 'GET' && path === '/api/v1/wallets') { route = 'listWallets'; }
  else if (method === 'POST' && path === '/api/v1/wallets') { route = 'createWallet'; }
  else if (method === 'GET' && segments.length === 5 && segments[3] === 'wallets' && segments[4] !== '') { route = 'getWallet'; }
  else if (method === 'POST' && segments.length === 6 && segments[3] === 'wallets' && segments[5] === 'transactions') { route = 'recordTransaction'; }
  if (!route) { return error(404, 'Cannot ' + method + ' ' + path, 'Not Found'); }

  // 3. Guard.
  var who = signedIn();
  if (!who) { return error(401, MSG.notSignedIn, 'Unauthorized'); }
  var cookie = who.cookie;

  // GET /api/v1/currencies
  if (route === 'listCurrencies') {
    return respond(200, {
      currencies: CURRENCIES.map(function (c) { return { code: c[0], name: c[1], minorDigits: c[2] }; })
    }, cookie);
  }

  // GET /api/v1/wallets — owned Wallets, newest createdAt first (ties: id desc)
  if (route === 'listWallets') {
    var mine = [];
    for (var id in state.wallets) {
      if (state.wallets[id].userId === who.userId) { mine.push(state.wallets[id]); }
    }
    mine.sort(function (a, b) { return desc(a.createdAt, b.createdAt) || desc(a.id, b.id); });
    return respond(200, {
      wallets: mine.map(function (w) { return { id: w.id, name: w.name, currency: w.currency, createdAt: w.createdAt }; })
    }, cookie);
  }

  // POST /api/v1/wallets — DTO order: name, currency, openingBalanceMinor
  if (route === 'createWallet') {
    var wMessages = [];
    var name = typeof parsed.name === 'string' ? parsed.name.trim() : null;
    if (name === null || name.length === 0) { wMessages.push(MSG.walletName); }
    else if (name.length > 60) { wMessages.push(MSG.walletNameLength); }
    if (!findCurrency(parsed.currency)) { wMessages.push(MSG.currency); }
    var opening = parsed.openingBalanceMinor;
    var openingValue = null;
    if (typeof opening !== 'string' || !/^-?[0-9]+$/.test(opening)) { wMessages.push(MSG.openingBalance); }
    else {
      openingValue = BigInt(opening);
      if (absBig(openingValue) > MAX_MINOR) { wMessages.push(MSG.openingBalanceTooLarge); }
    }
    if (wMessages.length) { return error(400, wMessages, 'Bad Request', cookie); }
    var created = nowIso();
    var wallet = {
      id: uuid(),
      userId: who.userId,
      name: name,
      currency: parsed.currency,
      openingBalanceMinor: openingValue.toString(),
      createdAt: created,
      updatedAt: created
    };
    state.wallets[wallet.id] = wallet;
    return respond(201, walletJson(wallet), cookie);
  }

  // GET /api/v1/wallets/:walletId — Wallet + derived Balance + Transactions newest first
  if (route === 'getWallet') {
    var shown = ownedWallet(who.userId, segments[4]);
    if (!shown) { return error(404, MSG.walletNotFound, 'Not Found', cookie); }
    var list = state.transactions.filter(function (t) { return t.walletId === shown.id; });
    list.sort(function (a, b) {
      return desc(a.occurredOn, b.occurredOn) || desc(a.createdAt, b.createdAt) || desc(a.id, b.id);
    });
    var detail = walletJson(shown);
    detail.transactions = list.map(transactionJson);
    return respond(200, detail, cookie);
  }

  // POST /api/v1/wallets/:walletId/transactions — DTO (400) before visibility (404)
  if (route === 'recordTransaction') {
    var tMessages = [];
    if (parsed.kind !== 'income' && parsed.kind !== 'expense') { tMessages.push(MSG.kind); }
    var amount = parsed.amountMinor;
    var amountValue = null;
    if (typeof amount !== 'string' || !/^[0-9]+$/.test(amount)) { tMessages.push(MSG.amount); }
    else {
      amountValue = BigInt(amount);
      if (amountValue === BigInt(0)) { tMessages.push(MSG.amountPositive); }
      else if (amountValue > MAX_MINOR) { tMessages.push(MSG.amountTooLarge); }
    }
    var todayValid = isRealDate(parsed.today);
    if (!isRealDate(parsed.occurredOn)) { tMessages.push(MSG.occurredOn); }
    else if (todayValid && parsed.occurredOn > parsed.today) { tMessages.push(MSG.futureDate); }
    var note = null;
    if (parsed.note !== undefined && parsed.note !== null) {
      if (typeof parsed.note !== 'string' || parsed.note.trim().length > 200) { tMessages.push(MSG.note); }
      else { note = parsed.note.trim() === '' ? null : parsed.note.trim(); }
    }
    if (!todayValid) { tMessages.push(MSG.today); }
    if (tMessages.length) { return error(400, tMessages, 'Bad Request', cookie); }

    var target = ownedWallet(who.userId, segments[4]);
    if (!target) { return error(404, MSG.walletNotFound, 'Not Found', cookie); }
    var at = nowIso();
    var transaction = {
      id: uuid(),
      walletId: target.id,
      kind: parsed.kind,
      amountMinor: amountValue.toString(),
      occurredOn: parsed.occurredOn,
      note: note,
      createdAt: at,
      updatedAt: at
    };
    state.transactions.push(transaction);
    return respond(201, transactionJson(transaction), cookie);
  }

  return error(404, 'Cannot ' + method + ' ' + path, 'Not Found');
}
