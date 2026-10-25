/* Invisible human check for lead forms (the server half is
   netlify/functions/_lib/lead-guard.js; the same pair runs on every one of
   Jacob's sites, so change both everywhere at once).

   At submit the page finds a nonce so sha256("v1|<ts>|<email>|<phone digits>|<nonce>")
   starts with 12 zero bits (~0.1 s) and sends "v1.<ts>.<nonce>.<ms on page>"
   as `human`. Form-spam bots post the HTML without running JavaScript, so
   they never have one. Nothing for a visitor to click or solve.

     HumanCheck.token(email, phone)  -> Promise<string> ('' if the browser cannot)
     <form data-human-check>         native-submit forms: a hidden `human`
                                     input is filled in before the form sends */
(function () {
  'use strict';
  var T0 = Date.now();
  var BITS = 12;

  function zeroBits(buf) {
    var b = new Uint8Array(buf), n = 0;
    for (var i = 0; i < b.length; i++) {
      if (b[i] === 0) { n += 8; continue; }
      return n + Math.clz32(b[i]) - 24;
    }
    return n;
  }

  function token(email, phone) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle || !window.TextEncoder) return Promise.resolve('');
    var ts = String(Date.now());
    var onPage = String(Math.max(0, Date.now() - T0));
    var key = String(email || '').trim().toLowerCase() + '|' + String(phone || '').replace(/\D/g, '');
    var enc = new window.TextEncoder();
    var prefix = 'v1|' + ts + '|' + key + '|';
    function batch(start) {
      var jobs = [];
      for (var i = start; i < start + 64; i++) {
        jobs.push(subtle.digest('SHA-256', enc.encode(prefix + i)));
      }
      return Promise.all(jobs).then(function (out) {
        for (var j = 0; j < out.length; j++) {
          if (zeroBits(out[j]) >= BITS) return 'v1.' + ts + '.' + (start + j) + '.' + onPage;
        }
        return start < 2000000 ? batch(start + 64) : '';
      });
    }
    return batch(0).catch(function () { return ''; });
  }

  function attach(form) {
    if (form.__humanCheck) return;
    form.__humanCheck = true;
    form.addEventListener('submit', function (e) {
      if (form.__humanReady) { form.__humanReady = false; return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      if (form.__humanPending) return;          // a double click while the token is being made
      form.__humanPending = true;
      var email = form.querySelector('[name="email"]');
      var phone = form.querySelector('[name="phone"]');
      var input = form.querySelector('input[name="human"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'human';
        form.appendChild(input);
      }
      token(email ? email.value : '', phone ? phone.value : '').then(function (t) {
        input.value = t;
        // Resubmit on a fresh task: the digest can finish before this submit
        // event's dispatch does, and Chrome silently ignores requestSubmit()
        // while a submit event is still firing (the first click did nothing).
        setTimeout(function () {
          form.__humanPending = false;
          // submit() fires no submit event, so only requestSubmit() needs the pass.
          if (form.requestSubmit) { form.__humanReady = true; form.requestSubmit(); } else form.submit();
        }, 0);
      });
    }, true);
  }

  window.HumanCheck = { token: token, attach: attach };
  function scan() {
    var forms = document.querySelectorAll('form[data-human-check]');
    for (var i = 0; i < forms.length; i++) attach(forms[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
