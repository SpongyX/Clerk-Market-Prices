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
  // CONFIG - the only part you change per client / per Clerk design.
  // To find these values: right-click a price in the widget -> Inspect.
  // =========================================================================
  var CONFIG = {
    // Wraps each individual product card in the widget.
    cardSelector: '.clerk-slider-item .designs-card',

    // The product link inside a card (standard Shopify - rarely changes).
    productLinkSelector: 'a[href*="/products/"]',

    // REGULAR price: element wrapping a single price.
    regularPriceSelector: '[data-name="container1"][id="wCJychyn"]',

    // SALE price (optional): wraps BOTH the list price and the sale price.
    // The FIRST <p> = list price, the SECOND <p> = sale price.
    // Set to null if this design has no sale layout.
    salePriceSelector: '[data-name="container1"][id="aHJINy4F"]'
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

  function updateCard(card, data, currency) {
    // Sale layout first (list price + sale price).
    if (CONFIG.salePriceSelector) {
      var sale = card.querySelector(CONFIG.salePriceSelector);
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
    var reg = card.querySelector(CONFIG.regularPriceSelector);
    if (reg) {
      var p = reg.querySelector('p') || reg;
      p.textContent = fmt(data.price, currency);
    }
  }

  function hydrate() {
    var currency = window.Shopify && Shopify.currency && Shopify.currency.active;
    if (!currency) return;

    var cards = document.querySelectorAll(CONFIG.cardSelector);
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        var link = card.querySelector(CONFIG.productLinkSelector);
        if (!link) return;

        var m = (link.getAttribute('href') || '').match(/\/products\/([^?#/]+)/);
        if (!m) return;

        var handle = m[1];
        var key = handle + '_' + currency;

        // In-memory cache: same product in multiple sliders = 1 fetch.
        if (_priceCache[key]) {
          updateCard(card, _priceCache[key], currency);
          return;
        }

        fetch('/products/' + handle + '.js')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var data = { price: d.price, compare_at_price: d.compare_at_price };
            _priceCache[key] = data;
            updateCard(card, data, currency);
          })
          .catch(function () { /* leave original price on failure */ });
      })(cards[i]);
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
