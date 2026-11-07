import { ABI } from './abi.mjs';
import { effectiveReferrer } from './routes.mjs';
export async function helpPage(main, ctx) {
  const { h, chain, section, S, account, read, send, call, guarded, fmt, candidate, referralError, href, current, toast } = ctx;
  const sol = chain === 'solana', title = `${section === 'docs' ? 'Docs' : 'Referrals'} · ${sol ? 'Solana' : `Elysium ${S.m.chainId}`}`;
  const panel = h('section', { class: 'ely-card purr-help' }, h('h1', {}, title)); main.replaceChildren(panel);
  const p = text => h('p', {}, text), topic = (title, ...content) => h('section', {}, h('h2', {}, title), ...content.map(p));
  if (section === 'docs') {
    panel.append(p('Choose a chain in the shared header. Wallet connections are independent; switching never signs, sends or bridges funds.'),
      topic('Wallet and network', sol ? 'Use a discovered Solana Wallet Standard or injected wallet. This integration verifies Solana mainnet before signing. SOL pays network fees.' : `Configured Elysium network: ${S.m.chainId}. Official mainnet identity is not authenticated. HYPE pays gas.`),
      topic('Launch flow', sol ? 'Enter coin details, artwork and a quote asset. The existing Pump adapter verifies protocol quote admission and simulates the transaction. Metadata publication requires consent; wallet approval is separate. Operator prerequisites are shown in Create.' : 'Enter coin details, choose fees and an opening buy. The launcher creates a pool with the configured fee hook; the liquidity has no removal path. Launches require wallet-reviewed approvals and a transaction. Read the active manifest caps and review the actual costs.'),
      topic('Fees', sol ? 'The Pump adapter supports a 3% creator trading fee on admitted custom-quote pairs, paid directly to the creator. SOL/USDC standard fee schedules do not use this fixed-3% mode. Protocol fees and network rent/gas are separate. The swap adapter requests a zero platform swap fee; token and venue fees can still apply.' : `This deployment reports a platform target of ${Number(S.m.carbon.platformVolumeBps) / 100}% of volume. Its launch-referral direct tier is ${Number(S.m.carbon.referralDirectBps) / 100}% of the platform cut, not of trade volume. Actual pool rates, burn, keeper and holder splits are read from the configured contracts. Hypeliysium Swap V3 pool fees are separate.`),
      topic('Referrals', sol ? 'Solana referral binding, referral balances and referral claims are unavailable in this adapter. No EVM referral split is applied to Solana.' : 'Launch attribution uses the existing ?ref=0x… link format with an explicit Elysium chain. A saved link is only a candidate. The on-chain first binding wins; navigation and wallet connection do not bind it. Trader-referral support is deployment-specific and is not inferred from launch referrals.'),
      topic('Risk and disconnect', 'Tokens can lose all value. Wallet signatures and published metadata have consequences that changing a tab cannot undo. Disconnect clears the site connection, not wallet permissions or on-chain approvals.'),
      h('a', { class: 'ely-btn', href: href('referrals') }, 'Open referral dashboard'), h('a', { class: 'ely-btn', href: href('funding') }, 'Development funding'));
    if (sol) panel.append(h('a', { href: 'https://solscan.io', target: '_blank', rel: 'noopener noreferrer' }, 'Solana explorer'));
    else if (S.m.explorer) panel.append(h('a', { href: S.m.explorer, target: '_blank', rel: 'noopener noreferrer' }, 'Configured Elysium explorer'));
    else panel.append(p('No public explorer is configured for this local fork.'));
    const topics=[...panel.querySelectorAll(':scope > section')];
    const contents=h('nav',{class:'hlys-doc-nav','aria-label':'On this page'},h('strong',{},'On this page'),...topics.map((topic,index)=>{
      topic.id=`help-topic-${index}`;topic.tabIndex=-1;
      return h('button',{type:'button',onclick:()=>{topic.scrollIntoView();topic.focus({preventScroll:true});}},topic.querySelector('h2').textContent);
    }));
    const article=h('div',{class:'hlys-doc-article'},...topics);
    panel.insertBefore(h('div',{class:'hlys-doc-layout'},contents,article),panel.querySelector(':scope > a'));
    return;
  }
  panel.append(p('Hypeliysium attribution and balances are separate for each chain and wallet. Connecting another wallet does not establish a cross-chain identity.'));
  if (sol) { panel.append(topic('Unavailable on Solana', 'This Pump/swap deployment has no verified referral binding or payout integration. No SOL referral balance or payout is claimed. Elysium referral attribution remains saved for Elysium only.')); return; }
  if (referralError) panel.append(h('p', { class: 'ely-bad', role: 'status' }, referralError));
  if (candidate) panel.append(p(`Saved Elysium referral candidate: ${candidate}. It is not an on-chain binding.`));
  if (!account) { panel.append(p('Connect your Elysium wallet to read its binding and claimable WHYPE.')); return; }
  panel.append(p(`Wallet: ${account}`));
  const link = new URL(href('create'), location.origin); link.searchParams.set('ref', account); link.searchParams.set('refChain', 'elysium');
  const share = h('input', { value: link.href, readonly: true, id: 'purr-referral-link' });
  panel.append(h('label', { for: share.id }, 'Your Elysium launch referral link'), share, h('button', { class: 'ely-btn', onclick: () => navigator.clipboard.writeText(link.href).then(() => toast('Referral link copied.')).catch(() => { share.select(); toast('Select and copy the referral link.'); }) }, 'Copy referral link'));
  const [bound, owed, tiers] = await Promise.all([read(S.m.carbon.referralVault, ABI.vault, 'referrerOf', [account]), read(S.m.carbon.referralVault, ABI.vault, 'owed', [account, S.m.whype]), read(S.m.carbon.referralVault, ABI.vault, 'tiers')]);
  if (!current()) return;
  const existing = !/^0x0{40}$/i.test(bound);
  panel.append(topic('Launch referral binding', existing ? `Bound on-chain to ${bound}. This is write-once; a different referral link cannot replace it.` : 'No launch referrer is bound on-chain. A candidate is used only during an explicit wallet-approved launch.', `Effective referrer for this wallet: ${effectiveReferrer({ account, bound, candidate }) || 'none'}.`),
    topic('Claimable balance', `${fmt(owed)} WHYPE on Elysium ${S.m.chainId}. No SOL or fiat amount is combined with this balance.`, `Direct referral tier read from the vault: ${tiers.length ? Number(tiers[0]) / 100 : 0}% of the platform cut.`));
  const claim = h('button', { class: 'ely-btn', disabled: owed === 0n, onclick: () => guarded(claim, async () => { if (!current()) throw new Error('Wallet or chain changed. Reopen Referrals.'); await send('Claim Elysium launch referrals', { to: S.m.carbon.referralVault, data: call(ABI.vault, 'claim', [S.m.whype]) }); ctx.refresh(); }) }, 'Claim WHYPE'); panel.append(claim);
  panel.append(topic('Trader referrals', S.m.carbon.traderReferralBps == null ? 'Unavailable on this configured deployment. The manifest does not enable the trader-referral adapter. Launch referrals above are a separate mechanism.' : 'This manifest reports trader referrals, but this UI has no verified trader-binding/claim adapter for it. Existing on-chain trader bindings are left untouched; they are write-once.'));
}
