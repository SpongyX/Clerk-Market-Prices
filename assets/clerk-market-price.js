/*
 * Clerk x Shopify Markets — Correct Price Display
 * Fetches the real market price from Shopify and injects it into Clerk cards.
 * Edit CONFIG.designs to match your Clerk design selectors.
 */
(function () {
  'use strict';

  // ============================================================
  // CONFIG — edit this per client. One entry per Clerk design.
  // ============================================================
  var CONFIG = {
    productLinkSelector: 'a[href*="/products/"]',
    designs: [
      {
        // Design 1 — sliders
        cardSelector: '.clerk-slider-item .designs-card',
        regularPriceSelector: '[data-name="container1"][id="wCJychyn"]',
        salePriceSelector: '[data-name="container1"][id="aHJINy4F"]'
      }
      // ,{
      //   // Design 2 — add more designs here
      //   cardSelector: '.clerk-grid-item .designs-card',
      //   regularPriceSelector: '[data-name="container1"][id="XXXXXXXX"]',
      //   salePriceSelector: null
      // }
    ]
  };
  // ============================================================

  var _priceCache = {};
  var _fmtCache = {};

  function getFormatter(currency) {
    if (!(currency in _fmtCache)) {
      try {
        _fmtCache[currency] = new Intl.NumberFormat(navigator.language || 'en', {
          style: 'currency', currency: currency
        });
      } catch (e) {
        _fmtCache[currency] = null;
      }
    }
    return _fmtCache[currency];
  }

  function fmt(priceCents, currency) {
    var f = getFormatter(currency);
    return f ? f.format(priceCents / 100) : (priceCents / 100).toFixed(2) + '\u00a0' + currency;
  }

  function updateCard(card, design, data, currency) {
    if (design.salePriceSelector) {
      var sale = card.querySelector(design.salePriceSelector);
      if (sale) {
        var ps = sale.querySelectorAll('p');
        if (ps[0] && data.compare_at_price) ps[0].textContent = fmt(data.compare_at_price, currency);
        if (ps[1]) ps[1].textContent = fmt(data.price, currency);
        return;
      }
    }
    var reg = card.querySelector(design.regularPriceSelector);
    if (reg) {
      var p = reg.querySelector('p') || reg;
      p.textContent = fmt(data.price, currency);
    }
  }

  function hydrateDesign(design, currency) {
    var linkSel = design.productLinkSelector || CONFIG.productLinkSelector;
    var cards = document.querySelectorAll(design.cardSelector);

    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        if (card.getAttribute('data-clerk-price-done') === currency) return;

        var link = card.querySelector(linkSel);
        if (!link) return;

        var m = (link.getAttribute('href') || '').match(/\/products\/([^?#/]+)/);
        if (!m) return;

        var handle = m[1];
        var key = handle + '_' + currency;

        function apply(data) {
          updateCard(card, design, data, currency);
          card.setAttribute('data-clerk-price-done', currency);
        }

        if (_priceCache[key]) { apply(_priceCache[key]); return; }

        fetch('/products/' + handle + '.js')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var data = { price: d.price, compare_at_price: d.compare_at_price };
            _priceCache[key] = data;
            apply(data);
          })
          .catch(function () {});
      })(cards[i]);
    }
  }

  function hydrate() {
    var currency = window.Shopify && Shopify.currency && Shopify.currency.active;
    if (!currency) return;
    for (var d = 0; d < CONFIG.designs.length; d++) {
      hydrateDesign(CONFIG.designs[d], currency);
    }
  }

  function start() {
    Clerk('on', 'rendered', hydrate);
    hydrate(); // run once now in case Clerk already rendered
  }

  if (typeof Clerk === 'function') {
    start();
  } else {
    // Clerk not ready yet — retry until it is
    var tries = 0;
    var iv = setInterval(function () {
      if (typeof Clerk === 'function') { clearInterval(iv); start(); }
      else if (++tries > 50) { clearInterval(iv); }
    }, 100);
  }
})();
