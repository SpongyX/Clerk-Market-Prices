/*
 * Clerk x Shopify Markets - Correct Price Display
 * -------------------------------------------------
 * Replaces the price shown in Clerk recommendation/search widgets with the
 * exact Shopify Markets price for the visitor's active currency
 * (currency conversion + catalog markup + rounding), for any market,
 * currency and language.
 *
 * Requirements:
 *   - Store uses Shopify Markets (so /products/{handle}.js returns the
 *     localized, market-adjusted price).
 *   - Clerk is installed and the global `Clerk(...)` function is available
 *     before this script runs.
 *
 * Setup: edit the CONFIG block to match your Clerk design's selectors.
 * See README.md -> "Finding your selectors".
 */
(function () {
  'use strict';

  // =========================================================================
  // CONFIG - the only part you change per client.
  // Add one entry per Clerk DESIGN. Each design has its own auto-generated
  // IDs, so list them all here and the script handles every widget.
  // To find these values: right-click a price in the widget -> Inspect.
  // =========================================================================
  var CONFIG = {
    // Applied to every design unless overridden inside a design entry.
    // Standard Shopify product link - rarely needs changing.
    productLinkSelector: 'a[href*="/products/"]',

    designs: [
      {
        // --- Design 1 (e.g. sliders) ---
        // Wraps each individual product card.
        cardSelector: '.clerk-slider-item .designs-card',
        // REGULAR price: element wrapping a single price.
        regularPriceSelector: '[data-name="container1"][id="wCJychyn"]',
        // SALE price (optional): wraps BOTH list price and sale price.
        // FIRST <p> = list price, SECOND <p> = sale price. null if none.
        salePriceSelector: '[data-name="container1"][id="aHJINy4F"]'
      }
      // ,{
      //   // --- Design 2 (copy this block per extra design) ---
      //   cardSelector: '.clerk-grid-item .designs-card',
      //   regularPriceSelector: '[data-name="container1"][id="XXXXXXXX"]',
      //   salePriceSelector: null
      // }
    ]
  };
  // =========================================================================

  var _priceCache = {}; // handle+currency -> { price, compare_at_price }
  var _fmtCache = {};   // currency -> Intl.NumberFormat (built once per currency)

  function getFormatter(currency) {
    if (!(currency in _fmtCache)) {
      try {
        _fmtCache[currency] = new Intl.NumberFormat(navigator.language || 'en', {
          style: 'currency',
          currency: currency
        });
      } catch (e) {
        _fmtCache[currency] = null;
      }
    }
    return _fmtCache[currency];
  }

  // priceCents = Shopify price in minor units (e.g. 3695 => 36.95).
  function fmt(priceCents, currency) {
    var f = getFormatter(currency);
    return f
      ? f.format(priceCents / 100)
      : (priceCents / 100).toFixed(2) + '\u00a0' + currency;
  }

  function updateCard(card, design, data, currency) {
    // Sale layout first (list price + sale price).
    if (design.salePriceSelector) {
      var sale = card.querySelector(design.salePriceSelector);
      if (sale) {
        var ps = sale.querySelectorAll('p');
        if (ps[0] && data.compare_at_price) {
          ps[0].textContent = fmt(data.compare_at_price, currency);
        }
        if (ps[1]) {
          ps[1].textContent = fmt(data.price, currency);
        }
        return;
      }
    }
    // Regular layout (single price).
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
        // Skip cards already processed (a card may match more than one design).
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

        // In-memory cache: same product in multiple widgets = 1 fetch.
        if (_priceCache[key]) { apply(_priceCache[key]); return; }

        fetch('/products/' + handle + '.js')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var data = { price: d.price, compare_at_price: d.compare_at_price };
            _priceCache[key] = data;
            apply(data);
          })
          .catch(function () { /* leave original price on failure */ });
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

  if (typeof Clerk === 'function') {
    // Run on every Clerk render (covers ajax navigation / lazy widgets).
    Clerk('on', 'rendered', hydrate);
  } else {
    // Fallback: Clerk not ready yet - retry briefly.
    var tries = 0;
    var iv = setInterval(function () {
      if (typeof Clerk === 'function') {
        clearInterval(iv);
        Clerk('on', 'rendered', hydrate);
      } else if (++tries > 50) {
        clearInterval(iv);
      }
    }, 100);
  }
})();
