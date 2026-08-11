/* Scroll choreography — reveal on entry, sticky nav state.
   Everything degrades to fully-visible content without JS, and is disabled
   outright under prefers-reduced-motion. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Reveal ----------------------------------------------------------- */
  var targets = document.querySelectorAll('[data-reveal]');

  if (reduced || !('IntersectionObserver' in window)) {
    for (var i = 0; i < targets.length; i++) targets[i].classList.add('is-in');
  } else {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });

    for (var j = 0; j < targets.length; j++) {
      /* Anything already above the fold shows immediately — no first-paint flash. */
      var r = targets[j].getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92) targets[j].classList.add('is-in');
      else io.observe(targets[j]);
    }
  }

  /* --- Nav ------------------------------------------------------------- */
  var nav = document.getElementById('nav');
  var hero = document.getElementById('top');

  if (nav && hero && 'IntersectionObserver' in window) {
    var navIo = new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { rootMargin: '-72px 0px 0px 0px', threshold: 0 });
    navIo.observe(hero);
  }
}());
