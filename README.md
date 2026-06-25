# Clerk × Shopify Markets — Correct Price Display

Shows the real Shopify Markets price in Clerk widgets — including market markup, currency conversion and rounding — for any currency and language automatically.

---

## How it works

On each Clerk render, the script fetches `/products/{handle}.js` for each card. Shopify returns the fully computed price for the visitor's active market. That price replaces whatever Clerk rendered.

---

## Installation

1. Copy `assets/clerk-market-price.js` into your theme's `assets/` folder.
2. Copy `snippets/clerk-market-price.liquid` into your theme's `snippets/` folder.
3. In `layout/theme.liquid`, render it after the Clerk tracking snippet:

```liquid
{% render 'clerk-tracking' %}
{% render 'clerk-market-price' %}
```

4. Remove `currency_converter` from the Clerk config if present — it conflicts.

---

## Configuration

Edit the `CONFIG.designs` array in `assets/clerk-market-price.js`. Add one entry per Clerk design on the site.

```js
designs: [
  {
    cardSelector: '.clerk-slider-item .designs-card',
    regularPriceSelector: '[data-name="container1"][id="wCJychyn"]',
    salePriceSelector: '[data-name="container1"][id="aHJINy4F"]'
  }
]
```

### Finding selectors for a new design

1. Right-click a price in the widget → **Inspect**
2. Find the `<div data-name="container1" id="XXXXXXXX">` wrapping the price — use its `id` for `regularPriceSelector`
3. If the design has sale prices (list + sale), inspect one — it has two `<p>` tags — use its `id` for `salePriceSelector`. No sale layout? Set `salePriceSelector: null`
4. Right-click the whole product card → pick its wrapper class for `cardSelector`

---

## Console test

Before deploying, test on any page with a Clerk widget:

1. Switch to a non-default market/currency on the storefront
2. Open DevTools → Console → paste:

```js
fetch('/products/PRODUCT-HANDLE.js')
  .then(r => r.json())
  .then(d => console.log(d.price / 100, Shopify.currency.active));
```

If the price and currency are correct → the store supports this approach and you can deploy.
