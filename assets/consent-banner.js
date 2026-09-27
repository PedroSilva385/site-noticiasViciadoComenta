(function () {
  var CONSENT_KEY = 'vc_consent_v1';
  var CLARITY_TAG = 'yolt837er6';
  var clarityLoaded = false;
  var banner = document.getElementById('cookie-banner');
  if (!banner) return;

  var acceptBtn = document.getElementById('cookie-accept');
  var rejectBtn = document.getElementById('cookie-reject');

  function updateGtagConsent(granted) {
    if (typeof window.gtag !== 'function') return;
    var status = granted ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      ad_storage: status,
      ad_user_data: status,
      ad_personalization: status,
      analytics_storage: status
    });

    if (granted) {
      window.gtag('config', 'G-XJ3P1K6694');
    }
  }

  // Load Microsoft Clarity only after the visitor accepts cookies (RGPD).
  function loadClarity() {
    if (clarityLoaded) return;
    clarityLoaded = true;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.clarity.ms/tag/' + CLARITY_TAG;
    var firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {
      // ignore storage errors
    }
    updateGtagConsent(value === 'granted');
    if (value === 'granted') {
      loadClarity();
    }
    banner.hidden = true;
  }

  function loadConsent() {
    var stored = null;
    try {
      stored = localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      stored = null;
    }

    if (stored === 'granted') {
      banner.hidden = true;
      updateGtagConsent(true);
      loadClarity();
      return;
    }

    if (stored === 'denied') {
      banner.hidden = true;
      updateGtagConsent(false);
      return;
    }

    banner.hidden = false;
  }

  if (acceptBtn) {
    acceptBtn.addEventListener('click', function () {
      setConsent('granted');
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener('click', function () {
      setConsent('denied');
    });
  }

  loadConsent();
})();
