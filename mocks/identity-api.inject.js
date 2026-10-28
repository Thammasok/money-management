// Mountebank injection: a STATEFUL emulation of this project's own /api/v1 Identity endpoints (F-1).
//
// Used in mock mode only — Stage 7 (Bruno, port 4545) and Stage 21/23 (Vite /api proxy → port 4545,
// Playwright). It must be able to fail exactly the way the real NestJS Identity module fails
// (.claude/rules/e2e-contract.md → Test-double fidelity), so it implements the same rules:
// email normalisation + validation, the password rule, 409 on a taken email, 401 for wrong
// credentials, the per-email sign-in pause (10 failures in 15 min → 429 for 15 min, refused attempts
// not stored, success clears), 30-day sliding sessions, sign-out deletes only the current session.
//
// Source of truth for the contract: artifacts/F-1/02-flow.md (endpoint map + error catalogue).
// Where this double and the real service disagree, the real service is right.
//
// mocks/build-imposters.mjs embeds this file as the `inject` string of mocks/imposters.json.
function (config) {
  var state = config.state;
  var req = config.request;

  var THIRTY_DAYS_S = 2592000;
  var WINDOW_MS = 15 * 60 * 1000;
  var MSG = {
    email: 'Enter a valid email address.',
    passwordRule: 'Password must be at least 8 characters and include a letter, a number, and a symbol.',
    signInEmail: 'Enter your email.',
    signInPassword: 'Enter your password.',
    taken: 'This email is already registered.',
    badCredentials: 'Email or password is incorrect.',
    paused: 'Too many failed sign-ins. Try again later.',
    notSignedIn: 'Not signed in.'
  };

  if (!state.users) {
    // Mirrors the Liquibase `test` context seed (artifacts/F-1/03-scenarios.md → Seeded data).
    state.users = {
      'seed.user@example.test': {
        id: '0f100000-0000-4000-8000-000000000001',
        email: 'seed.user@example.test',
        password: 'Seed-Pass-1'
      }
    };
    state.sessions = {}; // token -> { userId, email, expiresAt }
    state.attempts = {}; // email -> [ms, ms, ...]
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
  function body() {
    if (req.body === undefined || req.body === null || req.body === '') { return {}; }
    if (typeof req.body === 'object') { return req.body; }
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  function respond(statusCode, payload, extraHeaders) {
    var headers = { 'Content-Type': 'application/json; charset=utf-8' };
    for (var k in (extraHeaders || {})) { headers[k] = extraHeaders[k]; }
    return { statusCode: statusCode, headers: headers, body: payload === undefined ? '' : JSON.stringify(payload) };
  }
  function error(statusCode, message, errorName, extra) {
    var payload = { statusCode: statusCode, message: message, error: errorName };
    for (var k in (extra || {})) { payload[k] = extra[k]; }
    return respond(statusCode, payload);
  }
  function sessionCookie(token) {
    return 'sid=' + token + '; Max-Age=' + THIRTY_DAYS_S + '; Path=/; HttpOnly; SameSite=Lax';
  }
  function clearedCookie() {
    return 'sid=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax';
  }
  function newSession(user) {
    var token = randomHex(43);
    state.sessions[token] = { userId: user.id, email: user.email, expiresAt: Date.now() + THIRTY_DAYS_S * 1000 };
    return token;
  }
  function activeSession() {
    var token = sidFromCookie();
    if (!token) { return null; }
    var s = state.sessions[token];
    if (!s || s.expiresAt <= Date.now()) { return null; }
    s.expiresAt = Date.now() + THIRTY_DAYS_S * 1000; // sliding
    return { token: token, session: s };
  }
  function normaliseEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : value;
  }
  function isEmail(value) {
    return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  function meetsPasswordRule(value) {
    return typeof value === 'string' && value.length >= 8 && value.length <= 128 &&
      /[A-Za-z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9\s]/.test(value);
  }

  var method = String(req.method || '').toUpperCase();
  var path = String(req.path || '').replace(/\/+$/, '') || '/';

  // The real service accepts only JSON bodies (415 otherwise) — backend/src/http-security.ts, requireJsonBody.
  // Without this a Web App that forgets `Content-Type: application/json` (a string body then goes out as
  // text/plain) would pass in mock mode and fail only against the real backend.
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    var contentType = header('content-type');
    if (!contentType || !/^application\/json\s*(;|$)/i.test(String(contentType).trim())) {
      return error(415, 'Content-Type must be application/json', 'Unsupported Media Type');
    }
  }

  // POST /api/v1/users — sign up
  if (method === 'POST' && path === '/api/v1/users') {
    var b = body();
    if (b === null) { return error(400, 'Unexpected token in JSON body', 'Bad Request'); }
    var email = normaliseEmail(b.email);
    var messages = [];
    if (!isEmail(email)) { messages.push(MSG.email); }
    if (!meetsPasswordRule(b.password)) { messages.push(MSG.passwordRule); }
    if (messages.length) { return error(400, messages, 'Bad Request'); }
    if (state.users[email]) { return error(409, MSG.taken, 'Conflict'); }
    var user = { id: uuid(), email: email, password: b.password };
    state.users[email] = user;
    var token = newSession(user);
    return respond(201, { id: user.id, email: user.email }, { 'Set-Cookie': sessionCookie(token) });
  }

  // POST /api/v1/sessions — sign in
  if (method === 'POST' && path === '/api/v1/sessions') {
    var sb = body();
    if (sb === null) { return error(400, 'Unexpected token in JSON body', 'Bad Request'); }
    var sEmail = normaliseEmail(sb.email);
    var sMessages = [];
    if (typeof sEmail !== 'string' || sEmail.length === 0) { sMessages.push(MSG.signInEmail); }
    if (typeof sb.password !== 'string' || sb.password.length === 0) { sMessages.push(MSG.signInPassword); }
    if (sMessages.length) { return error(400, sMessages, 'Bad Request'); }

    var now = Date.now();
    var list = state.attempts[sEmail] || [];
    if (list.length) {
      var latest = Math.max.apply(null, list);
      var inWindow = list.filter(function (t) { return t > latest - WINDOW_MS; }).length;
      if (inWindow >= 10 && latest > now - WINDOW_MS) {
        // Refused attempts are NOT stored (Q-42).
        return error(429, MSG.paused, 'Too Many Requests', { retryAt: new Date(latest + WINDOW_MS).toISOString() });
      }
    }
    var found = state.users[sEmail];
    if (!found || found.password !== sb.password) {
      list.push(now);
      state.attempts[sEmail] = list;
      return error(401, MSG.badCredentials, 'Unauthorized');
    }
    delete state.attempts[sEmail];
    var sToken = newSession(found);
    return respond(200, { id: found.id, email: found.email }, { 'Set-Cookie': sessionCookie(sToken) });
  }

  // GET /api/v1/me
  if (method === 'GET' && path === '/api/v1/me') {
    var active = activeSession();
    if (!active) { return error(401, MSG.notSignedIn, 'Unauthorized'); }
    return respond(200, { id: active.session.userId, email: active.session.email },
      { 'Set-Cookie': sessionCookie(active.token) });
  }

  // DELETE /api/v1/sessions/current — sign out
  if (method === 'DELETE' && path === '/api/v1/sessions/current') {
    var current = activeSession();
    if (!current) { return error(401, MSG.notSignedIn, 'Unauthorized'); }
    delete state.sessions[current.token];
    return { statusCode: 204, headers: { 'Set-Cookie': clearedCookie() }, body: '' };
  }

  return error(404, 'Cannot ' + method + ' ' + path, 'Not Found');
}
