# Clerk × Shopify Markets — Correct Price Display

Make **Clerk recommendation & search widgets show the exact Shopify Markets price**
for every market, currency and language — including catalog price adjustments
(e.g. EU +20%, US +6%) and rounding rules (e.g. nearest `€0.95` / whole `$1`).

No per-currency `if` statements. One script, every market.

---

## Why

Clerk stores one base price per product (the store's primary currency, e.g. `£25`).
When a customer switches market/currency, the storefront applies conversion, a catalog
markup, and rounding — but Clerk's data doesn't know about those, so the widget shows
the wrong price (e.g. a plain converted `€30` instead of the real `€36.95`).

This integration fetches the **final, fully-computed price** from Shopify
(`/products/{handle}.js`) in the visitor's active currency and writes it into each
Clerk card. Shopify does all the math; the widget just displays the result.

> **Requirement:** the store must use **Shopify Markets**, so `/products/{handle}.js`
> returns the localized, market-adjusted price. This is the default for any store using
> Shopify's country/currency selector.

---

## How it works

1. Read the active currency from `Shopify.currency.active`.
2. For each Clerk card, read the product handle from its `/products/...` link.
3. `fetch('/products/{handle}.js')` → Shopify returns the price already converted,
   marked-up, and rounded for the current market.
4. Write the price into the card, formatted for the visitor's locale via
   `Intl.NumberFormat`.

---

## Installation

### 1. Add the script asset

Copy [`assets/clerk-market-price.js`](assets/clerk-market-price.js) into your theme's
`assets/` folder (Shopify admin → **Online Store → Themes → ⋯ → Edit code → Assets →
Add a new asset**).

### 2. Add the snippet

Copy [`snippets/clerk-market-price.liquid`](snippets/clerk-market-price.liquid) into
your theme's `snippets/` folder.

### 3. Render it after Clerk

In `layout/theme.liquid`, render the snippet **after** the Clerk tracking snippet:

```liquid
{% if settings.enable_clerk %}
  {% render 'clerk-tracking' %}
  {% render 'clerk-market-price' %}
{% endif %}
```

### 4. Remove the old currency converter

If your Clerk config still has a `currency_converter` formatter, **delete it** — it
double-converts now:

```js
// DELETE if present:
formatters: {
  currency_converter: function (price) { return (price * Shopify.currency.rate).toString(); }
}
```

### 5. Configure selectors for your design

Edit the `CONFIG` block at the top of `assets/clerk-market-price.js` to match your
Clerk design. See **Finding your selectors** below.

---

## Finding your selectors

The IDs like `wCJychyn` / `aHJINy4F` are **auto-generated per Clerk design**, so they
differ between designs. To adapt the `CONFIG` block:

1. Open a page with the widget → right-click a **price** → **Inspect**.
2. Find the wrapper around the price, e.g.:

   ```html
   <div data-name="container1" id="ABCD1234" class="clerk-design-component-ABCD1234">
     <div data-group="group1" data-container="true">
       <p>$36.00</p>
     </div>
   </div>
   ```

   → set `regularPriceSelector: '[data-name="container1"][id="ABCD1234"]'`.
3. If the design has **sale prices** (struck-through list price + sale price), inspect
   one — it will be a different wrapper with **two `<p>` tags** → set
   `salePriceSelector` to its `id`. No sale layout? Set `salePriceSelector: null`.
4. Right-click the whole **card** (image + title + price) and pick a wrapping class →
   `cardSelector`.

`productLinkSelector` (`a[href*="/products/"]`) is standard Shopify and rarely changes.

---

## Configuration reference

| Key | Description |
|---|---|
| `cardSelector` | Wraps each product card in the widget. |
| `productLinkSelector` | The `/products/...` link inside a card. Usually unchanged. |
| `regularPriceSelector` | Wrapper of a single (non-sale) price. |
| `salePriceSelector` | Wrapper of the list + sale price (two `<p>`). `null` if none. |

---

## Currency & language support

| Concern | Handled by |
|---|---|
| Currency (EUR, USD, SEK, JPY, …) | `Shopify.currency.active`; fetched price is in that currency. |
| Catalog markup (+20% / +6% …) | Applied by Shopify before returning the price. |
| Rounding (`€0.95`, whole `$`, `¥` no decimals) | Applied by Shopify before returning the price. |
| Number format (`36,95 €` vs `€36.95`) | `Intl.NumberFormat` using the browser language. |
| Currency symbol | Derived from the currency code automatically. |

No per-currency or per-language config required. New markets work automatically.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Prices don't change when testing in console | Clerk already fired `rendered`. Run `Clerk('rerender');` once (console only). |
| Prices don't change on the live site | Ensure `Clerk(...)` is defined before the script, and selectors match the design. |
| Still double-converted | The old `currency_converter` formatter is still in the Clerk config — remove it. |
| Some cards update, others don't | Those use a different layout (sale vs regular). Set both selectors. |
| Wrong currency | Confirm the store uses Shopify Markets and the selector changes `Shopify.currency.active`. |

---

## Console test snippet

Paste in DevTools on a market page to verify Shopify returns the right price:

```js
fetch('/products/REPLACE-WITH-HANDLE.js')
  .then(function (r) { return r.json(); })
  .then(function (d) { console.log(d.price / 100, Shopify.currency.active); });
```

---

## Alternative: server-side import

If you prefer **zero client-side code** and no price flicker, prices can instead be
imported per market into a dedicated Clerk store (configured with a `shop_market`).
That requires a separate Clerk store per market and a resync, and for percentage
markets depends on Shopify `contextualPricing` (correct API version + scopes). This
client-side script avoids those dependencies by always using the final storefront
price, which makes it the more robust option for percentage-markup markets.

---

## License

MIT — see [LICENSE](LICENSE).
