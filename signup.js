/* Sign-up for the experiment: name + email → the operator's Google Sheet → Discord.
   The Discord invite is NOT in the page. The sign-up endpoint returns it once the row
   is written, and the button appears only on a parsed { ok: true } — a failed submit
   says so and never shows a false "thank you". Without JS the page shows an email
   fallback instead (see the .no-js rule and <noscript> in the section). */
(function () {
  'use strict';

  var form = document.querySelector('form[data-signup]');
  if (!form) return;

  var KEY = 'x10-follow';
  var panel = document.getElementById('signup-done');
  var hello = document.getElementById('signup-hello');
  var open = document.getElementById('signup-open');
  var status = document.getElementById('signup-status');
  var btn = form.querySelector('button[type="submit"]');
  var label = btn ? btn.querySelector('[data-label]') : null;
  var idle = label ? label.textContent : '';
  var INVITE = /^https:\/\/discord\.(gg|com)\/[A-Za-z0-9/_-]+$/;
  var busy = false;

  function say(msg, bad) {
    if (!status) return;
    status.textContent = msg || '';
    status.classList.toggle('is-bad', !!bad);
  }

  function done(invite, name, remembered) {
    if (!INVITE.test(invite || '')) return false;
    var first = String(name || '').trim().split(/\s+/)[0];
    if (hello) hello.textContent = remembered
      ? 'You are already following' + (first ? ', ' + first : '') + '.'
      : 'You are in' + (first ? ', ' + first : '') + '.';
    open.setAttribute('href', invite);
    form.hidden = true;
    panel.hidden = false;
    if (!remembered) { try { panel.focus(); } catch (e) {} }
    return true;
  }

  /* Returning visitor: show the button straight away. */
  try {
    var saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (saved && saved.invite) done(saved.invite, saved.name, true);
  } catch (e) {}

  function send(data) {
    /* A private preview never writes to the real sheet: it carries a stub instead. */
    var stub = form.getAttribute('data-preview-stub');
    if (stub) {
      return new Promise(function (resolve) {
        window.setTimeout(function () { resolve({ ok: true, invite: stub }); }, 500);
      });
    }
    var action = form.getAttribute('action') || '';
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(action)) {
      return Promise.reject(new Error('not-connected'));
    }
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    /* Form-encoded keeps this a CORS-simple request: no preflight, which Apps Script
       cannot answer. */
    return fetch(action, { method: 'POST', body: new URLSearchParams(data), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('http-' + r.status); return r.json(); })
      .then(function (j) { window.clearTimeout(timer); return j; }, function (e) { window.clearTimeout(timer); throw e; });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (busy) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    var data = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      consent: form.elements.consent.checked ? 'yes' : '',
      website: form.elements.website.value,
      source: '10xedge'
    };

    busy = true;
    btn.disabled = true;
    if (label) label.textContent = 'Sending…';
    say('');

    send(data).then(function (j) {
      if (!j || j.ok !== true) throw new Error((j && j.error) || 'refused');
      if (!done(j.invite, data.name, false)) throw new Error('no-invite');
      try { window.localStorage.setItem(KEY, JSON.stringify({ invite: j.invite, name: data.name })); } catch (e) {}
    }).catch(function (err) {
      var why = String(err && err.message);
      say(why === 'invalid' ? 'That name or email address was not accepted. Please check it and try again.'
        : why === 'consent' ? 'Please tick the box to confirm before signing up.'
        : 'That did not go through, and nothing was recorded. Please try again, or email hd@ekantikcapital.com and we will add you by hand.', true);
    }).then(function () {
      busy = false;
      btn.disabled = false;
      if (label) label.textContent = idle;
    });
  });
}());
