/** Monerochan's separately approved funding conversion, generalized to pad quotes. */
export function tradeHops({tokenMint,fundingMint,side,quoteAssets,preferredQuote,pairedLeveragedMints=[]}){
 if(!['buy','sell'].includes(side)||tokenMint===fundingMint)throw new Error('Choose different trade assets and a valid direction.');
 const quotes=new Set(quoteAssets.map(asset=>asset.mint));
 const from=side==='buy'?fundingMint:tokenMint,to=side==='buy'?tokenMint:fundingMint;
 if(quotes.has(from)||quotes.has(to))return [from,to];
 const bridge=pairedLeveragedMints.find(mint=>quotes.has(mint))||(quotes.has(preferredQuote)?preferredQuote:quoteAssets[0]?.mint);
 if(!bridge)throw new Error('No permitted intermediate quote asset is configured.');
 return [from,bridge,to];
}
