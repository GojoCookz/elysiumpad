import ledger from './funding-ledger.json';
import { validateFundingLedger, fundingSummary, fundingAmount } from './funding-ledger.mjs';
import { purrSolanaReadiness } from '../backend/purrlysium-solana.mjs';
import { formatDecimal, locale } from './i18n.mjs';

const CATEGORY = { 'platform-income': 'Own platform income', 'own-creator-income': 'Own creator income', 'other-creator-funds': 'Other creators’ funds', 'referrer-funds': 'Referrer liabilities', 'user-funds': 'User funds', development: 'Development spending', 'kntq-buyback': 'KNTQ purchases' };
const STATUS = { verified: 'Operator verified', unverified: 'Unverified', rejected: 'Rejected', proposed: 'Proposed', approved: 'Approved' };
export function fundingGovernance(manifest) {
  const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) ? value : null;
  return [
    { role: 'Contract administration', address: address(manifest.owner), source: 'manifest.owner' },
    { role: 'Treasury custody', address: address(manifest.treasury), source: 'manifest.treasury' },
  ];
}
export function fundingPage(main, { h, S, href }) {
  const panel = h('article', { class: 'ely-card purr-help funding-page' }); main.replaceChildren(panel);
  const p = text => h('p', {}, text);
  const link = (label, url) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label);
  const section = (id, title, ...children) => h('section', { id }, h('h2', {}, title), ...children);
  const day = value => value ? new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) + ' UTC' : 'Unknown';
  const money = (value, row) => value === null ? h('span', {}, 'Unknown') : h('span', { 'data-no-translate': '' }, `${formatDecimal(fundingAmount(value, row.decimals))} ${row.symbol}`);
  const pair = (label, value) => h('div', {}, h('dt', {}, label), h('dd', {}, value));
  panel.append(h('header', { class: 'funding-heading' }, h('h1', {}, 'Development funding'), h('span', { class: 'ely-pill' }, 'Budget unset')),
    p('Revenue we actually earn on Solana can help fund Elysium development. No percentage or transfer is committed.'),
    h('nav', { class: 'funding-links', 'aria-label': 'Funding sections' }, h('a', { href: '#funding-ledger' }, 'Receipts'), h('a', { href: '#funding-governance' }, 'Governance'), h('a', { href: href('create') }, 'Create coin'), h('a', { href: href('trade') }, 'Trade')));
  // Keep in-page anchors out of the application's hash router.
  panel.querySelectorAll('a[href^="#funding-"]').forEach(a => a.addEventListener('click', event => { event.preventDefault(); panel.querySelector(a.getAttribute('href'))?.scrollIntoView({ block: 'start' }); }));
  const readiness = purrSolanaReadiness({});
  panel.append(section('funding-policy', 'What qualifies',
    p('Only our own earned creator or platform revenue qualifies. Other creators’ fees, referral liabilities, user funds and trading volume are not development income.'),
    h('dl', { class: 'funding-facts' }, pair('Solana platform swap fee', h('span', { 'data-no-translate': '' }, `${readiness.platformSwapFeeBps} bps`)), pair('Creator fee recipient', 'Connected creator')),
    h('details', {}, h('summary', {}, 'Accounting policy'), p('Verified means checked by the trusted operator against linked evidence, not automatically verified by this website. Amounts stay separate by network and asset.'), p('A reconciled ledger balance covers the listed eligible receipts and spending through its stated date. It is not a wallet balance. Missing records are unknown, not zero.'))));
  let groups;
  try { validateFundingLedger(ledger); groups = fundingSummary(ledger); }
  catch { panel.append(h('p', { class: 'ely-bad', role: 'alert' }, 'Funding records are unavailable. No totals are assumed.')); return; }
  const download = h('button', { class: 'ely-btn', type: 'button', onclick: () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(ledger, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: 'hyperlysium-funding-ledger.json' }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } }, 'Download ledger');
  const ledgerSection = section('funding-ledger', 'Receipts', h('div', { class: 'funding-toolbar' }, h('p', {}, h('span', {}, 'Updated'), ': ', h('span', {}, day(ledger.updatedAt))), download));
  if (!ledger.records.length) ledgerSection.append(h('div', { class: 'funding-empty' }, h('h3', {}, 'No receipts published'), p('Revenue, spending and balance are unknown. No financial activity is inferred from this empty ledger.')));
  for (const group of groups) {
    ledgerSection.append(h('section', { class: 'funding-asset' }, h('h3', { 'data-no-translate': '' }, `${group.symbol} · ${group.chain} ${group.network}`), h('code', {}, group.asset),
      h('dl', { class: 'funding-facts' }, pair('Recorded eligible income', money(group.income, group)), pair('Development spending', money(group.spending, group)), pair('KNTQ purchases', money(group.buybacks, group)), pair('Reconciled ledger balance', money(group.balance, group))),
      p(group.asOf ? `As of ${day(group.asOf)}` : 'Not reconciled')));
  }
  const records = h('ul', { class: 'funding-records' });
  for (const row of ledger.records) {
    records.append(h('li', {}, h('header', {}, h('strong', {}, CATEGORY[row.category]), h('span', { class: 'ely-pill' }, STATUS[row.verification])),
      money(row.amountAtomic, row), h('p', { 'data-no-translate': '' }, `${row.chain} ${row.network} · ${day(row.timestamp)}`),
      h('code', {}, row.transaction), row.evidence ? link('Evidence', row.evidence) : p('No verification evidence'),
      row.chain === 'solana' ? link('Transaction', `https://solscan.io/tx/${row.transaction}`) : p('Official Elysium network identity remains unverified.')));
  }
  ledgerSection.append(records, h('details', {}, h('summary', {}, 'How records are published'), p('A trusted operator validates and imports evidence offline, then rebuilds this read-only snapshot. Public visitors cannot add or edit financial records.'))); panel.append(ledgerSection);
  const allocations = section('funding-allocations', 'Allocations', p('Proposals and approvals are plans, not payments. The development budget percentage is unset.'));
  if (!ledger.allocations.length) allocations.append(p('No proposed or approved allocations recorded.'));
  for (const row of ledger.allocations) allocations.append(h('div', { class: 'funding-allocation' }, h('h3', {}, CATEGORY[row.purpose]), h('span', { class: 'ely-pill' }, STATUS[row.status]), money(row.amountAtomic, row), h('p', { 'data-no-translate': '' }, `${row.chain} ${row.network} · ${day(row.timestamp)}`), row.evidence ? link('Evidence', row.evidence) : p('No approval evidence')));
  panel.append(allocations, section('funding-buybacks', 'KNTQ policy', p('KNTQ buybacks are separate from development spending. No percentage is approved and this implementation executes no purchases.')));
  const governance = section('funding-governance', 'Governance', p('Hypeliysium administration and treasury custody are independently configured and unverified. Another project’s governance does not establish Hypeliysium ownership.'),
    p('Configured addresses do not prove ownership, signer identities or a multisig threshold. No authenticated official Elysium RPC identity is available for those checks.'));
  for (const row of fundingGovernance(S.m)) governance.append(h('div', { class: 'funding-role' }, h('h3', {}, row.role), row.address ? h('code', {}, row.address) : p('Not configured'), h('p', {}, S.m.local ? 'Local-fork configuration only' : 'Configuration only — unverified'), h('small', { 'data-no-translate': '' }, row.source)));
  governance.append(p('No verified Solana treasury address is published in this snapshot.'), link('Official Elysium connection documentation', 'https://elysium.kinetiq.xyz/docs/connecting-to-elysium'), p('Older local 99901 references are not authenticated official-mainnet evidence. No production readiness is claimed.'));
  governance.append(h('details', {}, h('summary', {}, 'Historical governance context'),
    p('The separate L2 deployment originally planned a 2-of-3 Safe. A later owner instruction skipped the Safe for both administration and treasury; its manifest configures a plain wallet for both roles. This is historical and configuration evidence, not verified Hypeliysium governance.'),
    p('Historical November 4 reads reported a pending PairRegistry ownership transfer. Acceptance remains unverified. After official network authentication, pin a block and check applicable Safe owners and threshold, vault treasury, factory owner and PairRegistry owner and pending owner.')));
  panel.append(governance);
}
