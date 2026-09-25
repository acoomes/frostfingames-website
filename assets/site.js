// Frostfin Games: progressive enhancement for the signup forms.
// Without JS the forms still POST to /api/subscribe and redirect back.
(function () {
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  var FALLBACK = 'Something went sideways. Email hello@frostfingames.com and we’ll add you by hand.';

  function say(form, text, ok) {
    var msg = form.querySelector('.form-msg');
    msg.textContent = text;
    msg.className = 'form-msg ' + (ok ? 'ok' : 'err');
  }

  document.querySelectorAll('form[data-signup]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var button = form.querySelector('button');
      button.disabled = true;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; }); })
        .then(function (r) {
          if (r.ok) {
            say(form, r.body.message || 'You’re on the list. Talk soon!', true);
            form.querySelector('input[type=email]').value = '';
          } else {
            say(form, r.body.message || FALLBACK, false);
          }
        })
        .catch(function () { say(form, FALLBACK, false); })
        .then(function () { button.disabled = false; });
    });
  });

  // No-JS round trip lands back here with ?subscribed=1 or ?subscribed=0.
  var status = new URLSearchParams(location.search).get('subscribed');
  if (status !== null) {
    var form = document.querySelector('#signup form[data-signup]');
    if (form) say(form, status === '1' ? 'You’re on the list. Talk soon!' : FALLBACK, status === '1');
    history.replaceState(null, '', location.pathname + location.hash);
  }
})();
