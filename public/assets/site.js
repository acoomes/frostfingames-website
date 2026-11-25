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

  // Trailer: a big play button over the poster. On phones, playing goes
  // fullscreen (and landscape where the browser allows) so it's watchable.
  document.querySelectorAll('[data-trailer]').forEach(function (fig) {
    var video = fig.querySelector('video');
    var button = fig.querySelector('.play-overlay');
    if (!video || !button) return;
    var phone = window.matchMedia('(max-width: 900px), (pointer: coarse)');
    var wentFullscreen = false;
    video.controls = false;
    button.hidden = false;

    button.addEventListener('click', function () {
      button.hidden = true;
      video.controls = true;
      var playing = video.play();
      if (playing && playing.catch) playing.catch(function () {});
      if (!phone.matches) return;
      if (video.requestFullscreen) {
        video.requestFullscreen().then(function () {
          wentFullscreen = true;
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {});
        }).catch(function () {});
      } else if (video.webkitEnterFullscreen) {
        try { video.webkitEnterFullscreen(); } catch (e) {}
      }
    });

    document.addEventListener('fullscreenchange', function () {
      if (document.fullscreenElement || !wentFullscreen) return;
      wentFullscreen = false;
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    });
    video.addEventListener('ended', function () {
      if (document.fullscreenElement === video) document.exitFullscreen().catch(function () {});
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
