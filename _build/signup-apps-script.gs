/**
 * 10xedge — sign-up endpoint for "Follow the experiment".
 *
 * Paste this into the Apps Script editor of the Google Sheet that should hold the
 * sign-ups (Extensions → Apps Script), then Deploy → New deployment → Web app:
 *     Execute as:      Me
 *     Who has access:  Anyone
 * Copy the URL ending in /exec and put it in _build/figures.json →
 * experiment.signup.endpoint. Full steps: _docs/SIGNUP-SETUP.md.
 *
 * One row per person, keyed by lower-cased email. The Discord invite is returned only
 * after the row is written, so the page never shows the button for a sign-up that was
 * not recorded.
 */

var SHEET_NAME = 'Sign-ups';
var INVITE = 'https://discord.gg/GawjC6ef7t';
var MAX_ROWS = 20000;        // hard stop: the sheet cannot be flooded past this
var MAX_PER_MINUTE = 30;     // across all visitors
var HEADERS = ['First signed up', 'Name', 'Email', 'Source', 'Last submitted', 'Submissions'];

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};

    // Honeypot: a person never fills this field. Answer "ok" so a bot learns nothing,
    // write nothing, and return no invite.
    if (p.website) return json_({ ok: true });

    var name = clean_(p.name, 80);
    var email = clean_(p.email, 254).toLowerCase();
    var source = clean_(p.source, 40);

    if (p.consent !== 'yes') return json_({ ok: false, error: 'consent' });
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: 'invalid' });

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var cache = CacheService.getScriptCache();
      var key = 'm' + Math.floor(Date.now() / 60000);
      var n = Number(cache.get(key) || 0);
      if (n >= MAX_PER_MINUTE) return json_({ ok: false, error: 'busy' });
      cache.put(key, String(n + 1), 120);

      var sh = sheet_();
      var last = sh.getLastRow();
      var now = new Date();
      var emails = last > 1
        ? sh.getRange(2, 3, last - 1, 1).getValues().map(function (r) { return String(r[0]).toLowerCase(); })
        : [];
      var i = emails.indexOf(email);

      if (i >= 0) {
        // Same person again: update, never duplicate.
        var row = i + 2;
        var count = Number(sh.getRange(row, 6).getValue() || 1) + 1;
        sh.getRange(row, 2).setValue(safe_(name));
        sh.getRange(row, 5, 1, 2).setValues([[now, count]]);
      } else {
        if (last - 1 >= MAX_ROWS) return json_({ ok: false, error: 'full' });
        sh.appendRow([now, safe_(name), safe_(email), safe_(source), now, 1]);
      }
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true, invite: INVITE });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  }
}

/** Opening the /exec URL in a browser shows this — a quick "is it deployed" check. */
function doGet() {
  return json_({ ok: true, service: '10xedge sign-up', accepts: 'POST' });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Trim, collapse whitespace, drop control characters, cap the length. */
function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** A cell that begins with = + - or @ would be run as a formula. Store it as text. */
function safe_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
