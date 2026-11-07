/** Geometry only. No prediction, trend inference, trading signals, or external state. */
export const PATTERN_DEFINITIONS = Object.freeze([
  { id: 'doji', title: 'Doji', bars: 1, body: 'Positive range; body <= 10% of range.' },
  { id: 'spinning-top', title: 'Spinning top', bars: 1, body: 'Body > 10% and <= 30% of range; each wick >= 20% of range.' },
  { id: 'hammer-like', title: 'Hammer-like geometry', bars: 1, body: 'Body > 10% and <= 35% of range; lower wick >= twice body; upper wick <= 10% of range. No prior downtrend required.' },
  { id: 'shooting-star-like', title: 'Shooting-star-like geometry', bars: 1, body: 'Body > 10% and <= 35% of range; upper wick >= twice body; lower wick <= 10% of range. No prior uptrend required.' },
  { id: 'bullish-engulfing', title: 'Bullish body engulfing', bars: 2, body: 'Previous close < open; current close > open; current body contains previous body with at least one strictly extended edge. Wicks need not be engulfed.' },
  { id: 'bearish-engulfing', title: 'Bearish body engulfing', bars: 2, body: 'Previous close > open; current close < open; current body contains previous body with at least one strictly extended edge. Wicks need not be engulfed.' },
  { id: 'inside-bar', title: 'Inside bar', bars: 2, body: 'Current high <= previous high and low >= previous low, with at least one strict inequality.' },
  { id: 'outside-bar', title: 'Outside bar', bars: 2, body: 'Current high >= previous high and low <= previous low, with at least one strict inequality.' },
  { id: 'long-body', title: 'Long body', bars: 1, body: 'Positive range; body >= 80% of range. Color does not imply continuation.' },
  { id: 'flat-bar', title: 'Flat bar', bars: 1, body: 'Open, high, low, and close identical. Not classified as a doji; may reflect sparse trading or source aggregation.' },
].map(definition => Object.freeze({ ...definition, category: 'candle-geometry', evidence: 'explicit-convention', signal: false })));

const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const validTime = value => Number.isSafeInteger(value) && value >= 0;

/**
 * Bars: {open,high,low,close,volume,time?,closeTime?,closed?}.
 * Prices must be positive finite numbers, volume nonnegative. Times: epoch ms.
 * closedOnly defaults true: explicit closed:true or closeTime <= explicit asOf.
 * closed:false always excludes in closed-only mode. No wall-clock calls.
 * asOf excludes future time/closeTime even if closed:true. Unknown completion
 * is not inferred from the existence of a later bar. Two-bar matches never
 * bridge excluded records or known timestamp gaps. No sorting or gap filling.
 */
export function indexCandlePatterns(bars, options = {}) {
  if (!Array.isArray(bars)) throw new TypeError('bars must be an array');
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object');
  const { closedOnly = true, asOf, intervalMs, maxExamples = 5 } = options;
  for (const key of Object.keys(options)) {
    if (!['closedOnly', 'asOf', 'intervalMs', 'maxExamples'].includes(key)) throw new TypeError(`Unknown option: ${key}`);
  }
  if (typeof closedOnly !== 'boolean') throw new TypeError('closedOnly must be boolean');
  if (asOf !== undefined && !validTime(asOf)) throw new TypeError('asOf must be nonnegative safe integer milliseconds');
  if (intervalMs !== undefined && (!validTime(intervalMs) || intervalMs === 0)) throw new TypeError('intervalMs must be positive safe integer milliseconds');
  if (!Number.isInteger(maxExamples) || maxExamples < 0 || maxExamples > 100) throw new RangeError('maxExamples must be an integer from 0 to 100');
  const timed = bars.length > 0 && has(bars[0] ?? {}, 'time');
  if (intervalMs !== undefined && bars.length && !timed) throw new TypeError('intervalMs requires time on every bar');
  // Validate every supplied record, including excluded/future records. Never coerce strings.
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (!bar || typeof bar !== 'object' || Array.isArray(bar)) throw new TypeError(`Invalid bar ${i}`);
    if (!['open', 'high', 'low', 'close'].every(key => finite(bar[key]) && bar[key] > 0)
      || !finite(bar.volume) || bar.volume < 0) throw new TypeError(`Invalid OHLCV at ${i}`);
    if (bar.low > Math.min(bar.open, bar.close) || bar.high < Math.max(bar.open, bar.close)
      || bar.low > bar.high || !finite(bar.high - bar.low)) throw new RangeError(`Inconsistent OHLC at ${i}`);
    if (has(bar, 'time') !== timed || (timed && (!validTime(bar.time) || (i > 0 && bar.time <= bars[i - 1].time)))) throw new RangeError(`Invalid or unordered time at ${i}`);
    if (has(bar, 'closeTime') && (!timed || !validTime(bar.closeTime) || bar.closeTime <= bar.time)) throw new RangeError(`Invalid closeTime at ${i}`);
    if (timed && i > 0 && has(bars[i - 1], 'closeTime') && bars[i - 1].closeTime > bar.time) throw new RangeError(`Overlapping bars at ${i}`);
    if (has(bar, 'closed') && typeof bar.closed !== 'boolean') throw new TypeError(`Invalid closed flag at ${i}`);
  }
  const patterns = PATTERN_DEFINITIONS.map(({ id }) => ({ id, count: 0, examples: [] }));
  const lookup = new Map(patterns.map(pattern => [pattern.id, pattern]));
  let previousIndex = -2;
  let eligibleBars = 0;
  const record = (id, index, startIndex = index) => {
    const pattern = lookup.get(id);
    pattern.count++;
    if (pattern.examples.length < maxExamples) {
      const example = { index, startIndex };
      if (timed) example.time = bars[index].time;
      pattern.examples.push(example);
    }
  };
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (asOf !== undefined && ((timed && bar.time > asOf) || (has(bar, 'closeTime') && bar.closeTime > asOf))) continue;
    if (closedOnly && !(bar.closed === true || (bar.closed !== false && asOf !== undefined && has(bar, 'closeTime') && bar.closeTime <= asOf))) continue;
    eligibleBars++;
    const range = bar.high - bar.low;
    const body = Math.abs(bar.close - bar.open);
    const upper = bar.high - Math.max(bar.open, bar.close);
    const lower = Math.min(bar.open, bar.close) - bar.low;
    if (range === 0) record('flat-bar', i);
    else {
      if (body <= range * 0.1) record('doji', i);
      if (body > range * 0.1 && body <= range * 0.3 && upper >= range * 0.2 && lower >= range * 0.2) record('spinning-top', i);
      if (body > range * 0.1 && body <= range * 0.35 && lower >= body * 2 && upper <= range * 0.1) record('hammer-like', i);
      if (body > range * 0.1 && body <= range * 0.35 && upper >= body * 2 && lower <= range * 0.1) record('shooting-star-like', i);
      if (body >= range * 0.8) record('long-body', i);
    }
    const previous = bars[i - 1];
    const contiguous = previousIndex === i - 1
      && (intervalMs === undefined || bar.time - previous.time === intervalMs)
      && (!has(previous, 'closeTime') || previous.closeTime === bar.time);
    if (contiguous) {
      if (previous.close < previous.open && bar.close > bar.open && bar.open <= previous.close && bar.close >= previous.open && (bar.open < previous.close || bar.close > previous.open)) record('bullish-engulfing', i, i - 1);
      if (previous.close > previous.open && bar.close < bar.open && bar.open >= previous.close && bar.close <= previous.open && (bar.open > previous.close || bar.close < previous.open)) record('bearish-engulfing', i, i - 1);
      if (bar.high <= previous.high && bar.low >= previous.low && (bar.high < previous.high || bar.low > previous.low)) record('inside-bar', i, i - 1);
      if (bar.high >= previous.high && bar.low <= previous.low && (bar.high > previous.high || bar.low < previous.low)) record('outside-bar', i, i - 1);
    }
    previousIndex = i;
  }
  return {
    definitionsVersion: 1, closedOnly, eligibleBars,
    totalMatches: patterns.reduce((sum, pattern) => sum + pattern.count, 0),
    truncated: patterns.some(pattern => pattern.count > pattern.examples.length),
    patterns,
  };
}
