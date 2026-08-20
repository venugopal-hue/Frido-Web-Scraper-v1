/**
 * Degradation detection.
 *
 * Treating "zero rows" as the only failure signal is too crude: a scraper that
 * silently stops finding images, or returns 40% fewer products, or starts
 * handing back unparseable prices, is broken too — it just does not look
 * broken. Each check below compares this run against the last good one and
 * returns a plain-language symptom that can be fed straight to
 * `bdata scraper heal`.
 */

const pct = (n, total) => (total ? n / total : 0);

/** Fields whose null-rate is worth watching, with the tolerated ceiling. */
const COVERAGE_CHECKS = [
  { field: 'image_url', label: 'image_url', maxNullRate: 0.35 },
  { field: 'current_price', label: 'current_price', maxNullRate: 0.1 },
  { field: 'product_url', label: 'product_url', maxNullRate: 0.05 },
  { field: 'product_name', label: 'product_name', maxNullRate: 0.01 },
];

/** Proportional drop in row count that counts as a regression. */
const ROW_DROP_THRESHOLD = 0.4;

/** How much a field's coverage may fall versus the previous run. */
const COVERAGE_DROP_THRESHOLD = 0.3;

/**
 * @param {object[]} current   Normalised products from this run.
 * @param {object[]} previous  Products from the last successful run (may be []).
 * @returns {{healthy: boolean, anomalies: object[], summary: string}}
 */
export function detectAnomalies(current, previous = []) {
  const anomalies = [];
  const n = current.length;

  if (n === 0) {
    anomalies.push({
      kind: 'no_rows',
      severity: 'critical',
      message: 'Extraction returned zero products.',
    });
    return finish(anomalies);
  }

  // 1. Row count collapse versus the previous run.
  if (previous.length >= 10) {
    const drop = (previous.length - n) / previous.length;
    if (drop >= ROW_DROP_THRESHOLD) {
      anomalies.push({
        kind: 'row_drop',
        severity: 'critical',
        message:
          `Product count fell from ${previous.length} to ${n} ` +
          `(${Math.round(drop * 100)}% fewer). The grid selector may no longer match every card.`,
      });
    }
  }

  // 2. Fields that are mostly empty this run.
  for (const check of COVERAGE_CHECKS) {
    const missing = current.filter((p) => p[check.field] === null || p[check.field] === undefined || p[check.field] === '').length;
    const rate = pct(missing, n);
    if (rate > check.maxNullRate) {
      anomalies.push({
        kind: 'field_coverage',
        field: check.field,
        severity: check.maxNullRate <= 0.05 ? 'critical' : 'warning',
        message:
          `${check.label} is missing on ${missing} of ${n} products ` +
          `(${Math.round(rate * 100)}%). Re-locate this field on the product card.`,
      });
    }
  }

  // 3. A field that used to be well populated and suddenly is not. This is the
  //    check that would have caught the lazy-loaded images regressing.
  if (previous.length >= 10) {
    for (const check of COVERAGE_CHECKS) {
      const before = pct(previous.filter((p) => p[check.field]).length, previous.length);
      const after = pct(current.filter((p) => p[check.field]).length, n);
      if (before - after >= COVERAGE_DROP_THRESHOLD) {
        anomalies.push({
          kind: 'coverage_regression',
          field: check.field,
          severity: 'critical',
          message:
            `${check.label} coverage dropped from ${Math.round(before * 100)}% to ` +
            `${Math.round(after * 100)}% since the last run.`,
        });
      }
    }
  }

  // 4. Prices that parsed to something implausible — a sign the selector has
  //    latched onto the wrong element (a rating, a review count, an EMI figure).
  const badPrices = current.filter(
    (p) => p.current_price !== null && (p.current_price <= 0 || p.current_price > 1_000_000)
  ).length;
  if (badPrices > 0) {
    anomalies.push({
      kind: 'price_range',
      severity: 'warning',
      message: `${badPrices} products have an implausible price. The price selector may be reading the wrong element.`,
    });
  }

  // 5. Discounts that do not agree with the prices they sit next to.
  const inconsistent = current.filter((p) => {
    if (!p.original_price || !p.current_price || !p.discount_percent) return false;
    const implied = ((p.original_price - p.current_price) / p.original_price) * 100;
    return Math.abs(implied - p.discount_percent) > 15;
  }).length;
  if (inconsistent > n * 0.2) {
    anomalies.push({
      kind: 'discount_mismatch',
      severity: 'warning',
      message:
        `${inconsistent} of ${n} products have a discount_percent that disagrees with ` +
        `their own prices by more than 15 points.`,
    });
  }

  return finish(anomalies);
}

function finish(anomalies) {
  const critical = anomalies.filter((a) => a.severity === 'critical');
  return {
    healthy: anomalies.length === 0,
    shouldHeal: critical.length > 0,
    anomalies,
    critical,
    summary: anomalies.map((a) => a.message).join(' '),
  };
}

/** Turn detected anomalies into a heal prompt describing the symptom. */
export function healPromptFor(anomalies) {
  const lines = [
    'This scraper targets Shopify collection pages where the product grid is rendered client-side.',
    'The most recent run showed these problems:',
    ...anomalies.map((a, i) => `${i + 1}. ${a.message}`),
    'Re-locate the affected fields on each product card and return them for every row.',
    'Keep all currently working fields unchanged.',
  ];
  return lines.join(' ').slice(0, 500);
}
