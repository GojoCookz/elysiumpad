/** Original plain-text educational material. No third-party article text or market history. */
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const REFERENCES = freeze([
  { id: 'finra-orders', publisher: 'FINRA', title: 'Order Types', url: 'https://www.finra.org/investors/investing/investment-products/stocks/order-types', accessed: '2026-10-26', evidence: 'primary-investor-education', supports: 'Market, limit, stop and stop-limit mechanics; execution and price uncertainty.', limits: 'US securities education; crypto venues may implement different triggers and order conditions.' },
  { id: 'finra-geared', publisher: 'FINRA', title: 'The Lowdown on Leveraged and Inverse Exchange-Traded Products', url: 'https://www.finra.org/investors/insights/lowdown-leveraged-and-inverse-exchange-traded-products', published: '2022-07-28', accessed: '2026-10-26', evidence: 'primary-investor-education', supports: 'Reset objectives, compounding, holding-period divergence and expenses.', limits: 'ETPs are not crypto leveraged tokens. This supports reset mathematics, not any token-specific leverage or legal classification.' },
  { id: 'uniswap-swaps', publisher: 'Uniswap', title: 'Understanding Swaps on Uniswap', url: 'https://docs.uniswap.org/concepts/protocol/swaps', accessed: '2026-10-26', evidence: 'primary-protocol-documentation', supports: 'Pool execution, liquidity-dependent price impact, slippage and minimum-output guards.', limits: 'Protocol-specific documentation; fees, chain execution and protections vary. No endorsement of a pool or router.' },
]);

export const RISK_NOTICE = 'This material is educational, not personalized financial advice or a recommendation to trade. Trading can cause substantial losses, including the entire amount committed. Borrowing or some derivatives can create losses beyond initial capital. Stops, chart patterns and paper results do not guarantee protection or future returns. Verify each instrument, issuer, venue, fee schedule and applicable law before risking money.';

const exercise = (id, prompt, answer, explanation) => ({ id, type: 'worked-response', synthetic: true, prompt: `Synthetic exercise: ${prompt}`, answer, explanation });
const lesson = (id, title, category, evidence, body, example, exercises, references = []) => ({
  id, title, category, evidence, body, example: { synthetic: true, label: 'Synthetic teaching example; not market history.', body: example }, exercises, references,
});

export const CURRICULUM = freeze({
  id: 'trading-fundamentals', version: 1, title: 'Trading fundamentals: evidence before conviction',
  riskNotice: RISK_NOTICE,
  reuse: 'Original modular prose and synthetic exercises; no copied articles, licensed market data, screenshots, or performance claims. Source links are citations, not a transfer of third-party rights. Distribution remains subject to the repository license and local financial-promotion rules.',
  references: REFERENCES,
  lessons: [
    lesson('price-and-exposure', 'Know what you own', 'fundamentals', 'mechanics',
      'A quoted price is denominated in a quote asset per unit of a base asset. Position value equals units times price; it is not the same as cash available or realized profit. A spot token, a perpetual contract, a share and a leveraged token create different claims and failure modes. Identify contract address, chain, decimals, issuer, redemption rights and venue before comparing prices. A ticker alone does not establish identity or underlying exposure.',
      'Ten units at 12 quote units have a position value of 120 before selling costs. A symbol ending in 3L does not establish actual 3x exposure.', [
        exercise('exposure-01', 'You own 8 units quoted at 15. What is marked value?', '120 quote units, before costs.', '8 times 15 is 120; realizing that value still requires an executable sale.'),
        exercise('exposure-02', 'Two contracts share a ticker. Can their prices establish arbitrage?', 'No; verify instrument identity and transfer/redemption constraints first.', 'Different rights, chains, fees and settlement risks can explain a price difference.'),
      ]),
    lesson('risk-budget', 'Set a loss budget before entry', 'risk', 'arithmetic-and-planning',
      'Separate an affordable account loss budget from a forecast. Planned risk is an estimate conditional on execution, not a maximum possible loss. Choose an invalidation rule, an exit mechanism, a position cap and a response to outages before entering. Keep essential living funds outside speculative capital. Multiple correlated positions can fail together; per-trade limits do not replace portfolio limits. No universal risk percentage is appropriate for everyone.',
      'An illustrative 2,000-unit paper account with a chosen 0.5% planning budget allocates 10 units of planned risk, not permission to lose more.', [
        exercise('risk-01', 'A paper account is 4,000 and chosen risk budget is 0.75%. Compute planned risk.', '30 account units.', '4,000 times 0.0075 equals 30; the percentage is illustrative, not a recommendation.'),
        exercise('risk-02', 'Four correlated positions each plan to risk 20. Is portfolio risk only 20?', 'No; combined planned risk is 80 before gap and execution risks.', 'Separate positions can lose simultaneously; correlation may increase in stress.'),
      ], ['finra-orders']),
    lesson('position-sizing', 'Size from invalidation and costs', 'risk', 'arithmetic',
      'For a simple unlevered long, illustrative quantity = cash risk budget / (entry minus planned exit plus estimated round-trip cost per unit). Use compatible quote units and a positive denominator. Round down to allowed lot size and enforce available cash and concentration caps. Contract multipliers, nonlinear payoffs, funding and leverage require instrument-specific calculations. Moving an exit farther away after sizing increases risk; a stop can fill worse than planned.',
      'Budget 20, entry 50, exit 48, estimated costs 0.50 per unit: floor(20 / 2.50) = 8 whole units. Buying costs 400 plus entry fees.', [
        exercise('size-01', 'Budget 30, entry 25, exit 23, estimated costs 0.50 per unit. Whole-unit size?', '12 units, subject to cash and position caps.', '30 / (25 - 23 + 0.50) = 12. This assumes the planned exit is executable.'),
        exercise('size-02', 'Those 12 units exit at 21 instead of 23. Using the same costs, what is loss?', '54 quote units.', '12 times (25 - 21 + 0.50) = 54, exceeding the 30-unit planning budget.'),
      ], ['finra-orders']),
    lesson('orders', 'Market, limit, stop and stop-limit', 'execution', 'source-backed-mechanics',
      'A market order prioritizes execution over a fixed price, but does not guarantee execution under all conditions. A buy limit permits fills only at its limit or lower; a sell limit only at its limit or higher. A limit can partially fill or never fill. A stop-market becomes a market order when the venue trigger is met; its stop price is not a guaranteed fill. A stop-limit becomes a limit order and can remain unfilled during a gap. Check trigger basis, time-in-force, lot size and cancellation status with the actual venue.',
      'A sell stop at 95 may fill at 90 after a gap. A stop-limit with stop 95 and limit 94 may not sell at all if bids are below 94.', [
        exercise('orders-01', 'Buy limit 10 faces available asks only at 10.20. Does it fill immediately?', 'No.', 'The limit rejects prices above 10; waiting does not guarantee a later fill.'),
        exercise('orders-02', 'Sell stop 100, limit 99; next available bid is 95. What risk remains?', 'The triggered limit can remain unfilled.', 'Price control comes at the cost of execution certainty; loss can keep growing.'),
      ], ['finra-orders']),
    lesson('execution-costs', 'Spread, depth and realized execution', 'execution', 'mechanics-and-arithmetic',
      'Bid is a buyer price and ask a seller price; their difference is the quoted spread. Displayed top-of-book size is not total executable depth and may disappear. Large orders can consume multiple price levels, giving a volume-weighted average fill. Record quote age, requested quantity, partial fills, fees, rebates and actual receipts. A chart close or midprice is not an executable bid or ask. Use a conservative paper fill model rather than assuming every touch fills.',
      'Asks: 2 units at 10 and 3 at 11. Buying 5 averages (20 + 33) / 5 = 10.60 before fees.', [
        exercise('costs-01', 'Bid 9.90, ask 10.10. Immediate one-unit buy then sell, unchanged quotes and no fees: loss?', '0.20 quote units.', 'Pay the ask and receive the bid; midprice stability does not remove spread costs.'),
        exercise('costs-02', 'Fill 2 at 10 and 3 at 11, plus total fee 0.50. Total paid?', '53.50 quote units.', '20 + 33 + 0.50 = 53.50; effective cost is 10.70 per unit.'),
      ], ['finra-orders']),
    lesson('market-structure', 'Trends, ranges and confirmation delay', 'chart-context', 'discretionary-heuristic',
      'Market structure is a description of selected highs and lows, not a law of price. Higher swing highs and lows are commonly called an uptrend; lower ones a downtrend; overlapping extremes can describe a range. Results depend on timeframe, swing rule and data source. A swing defined using later bars is known only when those bars close. Never backdate its availability in a simulation. Distinguish a descriptive break of a level from an executable, tested strategy.',
      'A pivot-high rule requiring two bars on its right cannot identify the pivot at its own close; availability begins after the second later bar closes.', [
        exercise('structure-01', 'A high at index 5 requires two later closed bars. Earliest confirmation index?', '7.', 'Bars 6 and 7 provide required right-side evidence; acting at 5 would use future information.'),
        exercise('structure-02', 'A five-minute uptrend appears inside a daily downtrend. Contradiction?', 'No; describe both horizons explicitly.', 'Timeframe selection changes observed structure and cannot itself prove predictive value.'),
      ]),
    lesson('support-resistance', 'Support and resistance are hypotheses', 'chart-context', 'discretionary-heuristic',
      'Support describes a region where past declines paused; resistance describes a region where past advances paused. Use regions with stated boundaries rather than certainty at a single tick. Define the lookback, touch rule and invalidation before reviewing outcomes. A prior resistance may later act as support, but this role-reversal narrative can fail. Repeated historical reactions do not guarantee resting orders remain. Do not select only levels that later worked.',
      'A paper analyst marks 98–100 before the next session and declares a close below 97 invalidation. This is a testable convention, not a guaranteed floor.', [
        exercise('levels-01', 'A marked support region breaks. Does the label require a bounce?', 'No.', 'Support summarizes prior observations; new information and liquidity can invalidate it.'),
        exercise('levels-02', 'An analyst redraws every failed level after the outcome. What is wrong?', 'Hindsight selection hides failures.', 'Keep versioned pre-outcome levels, rules and failed cases to evaluate a hypothesis fairly.'),
      ]),
    lesson('supply-demand', 'Zones do not reveal hidden inventory', 'chart-context', 'discretionary-heuristic',
      'Supply/demand zone analysis marks areas around prior consolidation or rapid departure. Definitions vary: wick boundaries, body boundaries and freshness rules produce different zones. A chart can show price and reported volume, not every participant inventory or unfilled order. Define zone construction, expiry, invalidation and entry assumptions in advance. Order-book depth can change or be canceled; a chart-drawn zone is not an order book and neither guarantees future liquidity.',
      'An analyst marks the full 40–42 range of three closed consolidation bars. Another uses bodies 40.50–41.50. Neither boundary is uniquely forced by the candles.', [
        exercise('zones-01', 'Does a fast departure from a zone prove unfilled buy orders remain?', 'No.', 'OHLCV does not identify outstanding order inventory or participant intent.'),
        exercise('zones-02', 'Two analysts use different zone widths. What must a paper test preserve?', 'The exact rule, boundaries, creation time and invalidation for each version.', 'Otherwise changing definitions confound the outcome comparison.'),
      ]),
    lesson('order-blocks', 'Order blocks: contested discretionary labels', 'chart-context', 'contested-heuristic',
      'Some traders call a last opposite-color candle before a large move an order block; others require a structure break, an imbalance or a retest. There is no universal definition. These are discretionary, contested chart heuristics, NOT proven institutional orders. OHLCV alone cannot identify a bank, institution, accumulation program or remaining position. A sharp move does not establish who traded or why. If studied, specify the rule, confirmation delay and failed cases; do not sell the label as a proven edge.',
      'A red candle before an upward move may be labeled a candidate only after the chosen departure rule is satisfied. The red candle itself supplies no participant identity.', [
        exercise('blocks-01', 'Can a red candle followed by a rally prove institutional buying?', 'No.', 'Many trading sequences yield the same OHLCV; participant identity is not observable from this geometry.'),
        exercise('blocks-02', 'A block rule requires the next three bars to rally. Can entry be simulated on the candidate candle close?', 'No.', 'The rule becomes knowable only after those three bars; earlier entry introduces lookahead.'),
      ]),
    lesson('candles', 'Read candle geometry without inventing signals', 'candlesticks', 'explicit-convention',
      'Body = absolute close minus open; range = high minus low; upper wick = high minus max(open, close); lower wick = min(open, close) minus low. Doji, spinning top, hammer-like and shooting-star-like labels summarize ratios. Engulfing compares bodies; inside and outside bars compare full ranges. Published conventions differ. This package states exact thresholds and omits implied reversal or trend context. Flat bars are separate. A formation does not establish causal order flow or predictive performance.',
      'Open 108, high 111, low 100, close 110: body 2, range 11, upper wick 1 and lower wick 8, meeting this package hammer-like geometry.', [
        exercise('candles-01', 'Open 100, high 110, low 90, close 101. Body/range and label?', '1/20 = 5%; doji under the stated <=10% rule.', 'The label describes a small body, not a buy or sell instruction.'),
        exercise('candles-02', 'Does body engulfing require the new high and low to exceed prior wicks?', 'No.', 'Body engulfing uses open/close bounds; outside-bar geometry uses high/low bounds.'),
      ]),
    lesson('closed-data', 'Closed bars, missing intervals and honest testing', 'data-quality', 'engineering-convention',
      'An open candle can change high, low, close and volume until completion. Only confirmed completed bars should populate a closed-candle study. Supply completion flags or explicit close times and an as-of cutoff; never use the current wall clock implicitly. Missing intervals remain missing: do not fabricate flat candles or pretend a multi-interval pair is consecutive. Keep venue, instrument, timeframe, timezone, source and retrieval provenance outside the geometry when available. Volume units may differ across feeds.',
      'Bars at 0 and 120,000 ms with a declared 60,000 ms interval contain a gap. The index can label each eligible bar but will not form a two-bar pattern across that gap.', [
        exercise('data-01', 'An unfinished candle currently looks like a hammer. Is its final shape known?', 'No.', 'Further trades can change every shape ratio before completion.'),
        exercise('data-02', 'Two expected one-minute bars are separated by three minutes. Fill the gap with invented OHLC?', 'No.', 'Preserve the missingness; invented prices falsely imply trading observations.'),
      ]),
    lesson('leverage-path', 'Leveraged products: objective is not a holding-period promise', 'leverage', 'source-backed-math-with-product-limits',
      'A resetting leveraged product targets exposure over a stated reset period, not necessarily a multiple of the underlying holding-period return. Compounded returns depend on the path and rebalance rules. Oscillation can erode value; persistent trends can compound differently, so erosion is not inevitable every period. Fees, funding, tracking error, rebalance thresholds, liquidity, issuer and smart-contract risks add uncertainty. FINRA ETP guidance supports reset mathematics, not the terms of an arbitrary crypto token. Verify actual token documentation, redemption and current exposure; a ticker never proves leverage or underlying holdings.',
      'Frictionless hypothetical daily 2x target: underlying 100 to 110 to 100 (+10%, then -9.0909%); product 100 to 120 to about 98.1818. This is arithmetic, not an actual product or price history.', [
        exercise('leverage-01', 'Hypothetical underlying returns +10%, then -10%. Ideal daily 2x product starts 100. End value?', '96 before fees; underlying ends 99.', '100 times 1.20 times 0.80 = 96. Twice the two-day underlying return would incorrectly predict 98.'),
        exercise('leverage-02', 'A token name says 3x. Is borrowing, liquidation or fixed exposure established?', 'No; obtain the instrument terms and current mechanism.', 'Tokens, margin accounts and perpetuals have distinct risks; no exposure metadata is inferred here.'),
      ], ['finra-geared']),
    lesson('pool-execution', 'Liquidity, price impact, slippage and fees', 'pools', 'source-backed-mechanics-and-synthetic-math',
      'In an AMM, a trade changes pool reserves and can move the execution price. Price impact is the effect of the trade itself; slippage is movement relative to the expected execution while pending. Headline total liquidity does not measure usable depth at every price, especially with concentrated liquidity. Pool, router, platform, network, transfer-tax and token-specific fees can all matter; inspect actual transaction receipts and quote conventions to avoid double-counting. A minimum-output guard bounds accepted output, not success or all costs. Failed transactions can still incur network costs. Never automatically increase tolerance to force an unsafe trade.',
      'Ideal fee-free constant-product pool: 1,000 base and 10,000 quote. Adding 1,000 quote returns 1,000 - 10,000,000 / 11,000 = about 90.9091 base, averaging 11 quote per base rather than initial marginal 10. This is not a live pool quote.', [
        exercise('pool-01', 'Quoted output 100 units, minimum output 99. What does the guard guarantee?', 'Execution must meet the guard or revert, subject to the actual contract; it does not guarantee completion.', 'Other costs, token behavior and contract correctness still matter.'),
        exercise('pool-02', 'Expected output 200 with chosen tolerance 1%. Minimum output before token rounding?', '198 units if 200 is the applicable net quote.', '200 times 0.99 = 198; confirm whether fees and transfer taxes are already included.'),
      ], ['uniswap-swaps']),
    lesson('journal-and-cases', 'Paper journal: evaluate process, not a lucky outcome', 'practice', 'planning-and-arithmetic',
      'Record pre-entry hypothesis, evidence versus heuristic, source and cutoff, instrument identity, entry and invalidation, order rules, size, cost assumptions and reasons to skip. Afterward record actual or simulated fills, exit, fees, net P&L, risk multiple, rule adherence and what remains unknown. Label paper fills and synthetic data prominently. Compare every eligible case, not only winners, and separate research from a later untouched evaluation sample. Paper execution omits real queues, stress and some liquidity constraints. A small win sample is not evidence of a reliable edge.',
      'Paper journal fields: case ID; synthetic flag; source/cutoff; hypothesis; size; cash/risk caps; order; quote age; planned versus modeled fills; net result; initial risk; rule adherence; review. A net loss of 15 against initial planned risk 10 is -1.5R, not -1R.', [
        exercise('journal-01', 'Eight paper wins of 5 and two paper losses of 25, with total costs 6. Net result?', '-16 account units.', '40 - 50 - 6 = -16. An 80% win rate does not imply profitability.'),
        exercise('journal-02', 'A trade violates the size rule but wins. Was the process valid?', 'No; record the win and the rule violation separately.', 'Outcome alone cannot validate a decision made with excessive or unauthorized risk.'),
        exercise('journal-03', 'A candidate zone needs later confirmation, the quote is stale and a gap makes a stop unreliable. Best next paper action?', 'Skip or wait for valid confirmation and a fresh executable quote; document the reason.', 'There is no obligation to trade. Fixing missing evidence is preferable to inventing a fill.'),
        exercise('journal-04', 'A strategy was tuned on all 50 available examples. Can those same results establish out-of-sample performance?', 'No.', 'They are in-sample observations. Preserve an untouched later sample and report costs, failures and uncertainty.'),
      ], ['finra-orders', 'finra-geared', 'uniswap-swaps']),
  ],
});

export function listLessons({ category } = {}) {
  return CURRICULUM.lessons.filter(item => category === undefined || item.category === category);
}

export function getLesson(id) {
  return CURRICULUM.lessons.find(item => item.id === id) ?? null;
}
