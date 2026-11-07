export const WXMR_MINT='WXMRyRZhsa19ety5erZhHg4N3xj3EVN92u94422teJp';
export const WSOL_MINT='So11111111111111111111111111111111111111112';
export const MAINNET_GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export const MAX_SLIPPAGE_BPS=300;
export function units(value,decimals){
 const s=String(value).trim();if(!/^\d+(\.\d+)?$/.test(s)||s.length>40)throw new Error('Enter a positive decimal amount.');
 const [whole,fraction='']=s.split('.');if(fraction.length>decimals)throw new Error(`Use at most ${decimals} decimal places.`);
 const amount=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 if(amount>18446744073709551615n)throw new Error('Amount is too large.');return amount;
}
export function displayUnits(value,decimals){const n=BigInt(value),base=10n**BigInt(decimals);return `${n/base}.${(n%base).toString().padStart(decimals,'0')}`.replace(/\.?0+$/,'')||'0';}
export function validateLaunch(input){
 const name=String(input.name||'').trim(),symbol=String(input.symbol||'').trim().toUpperCase();
 if(!name||new TextEncoder().encode(name).length>32)throw new Error('Coin name must use 1–32 UTF-8 bytes.');
 if(!/^[A-Z0-9]{1,10}$/.test(symbol))throw new Error('Ticker must use 1–10 letters or digits.');
 const description=String(input.description||'').trim();if(description.length>280)throw new Error('Description must be 280 characters or fewer.');
 return {name,symbol,description};
}
