// Literal-only release overlay: preserve the already-approved compiled Solana
// transaction implementation while correcting its consumer-facing copy.
import {readFile,writeFile} from 'node:fs/promises';
const replacements=[
 ['Mainnet test: read before you trade','Network details'],
 ['Read before you trade','Network details'],
 [' adapter units',''],[' adapter route',' market'],
 ['Solana adapter preview','Your coin preview'],
 ['Preview uses only entered values. No market data is inferred.','Your name, symbol and artwork appear here.'],
 ['Ready for metadata upload and a separate wallet review.','Add your coin details, then review the launch in your wallet.'],
 ['Risks and network details','Network details'],
 ['Cap during mainnet test:','Maximum:'],
 [' during the mainnet test',''],
 ['Discovery coverage and provenance','Details'],
 ['Unpriced pool record','Price not yet available'],
 ['Discover the next move','Explore tokens'],
];
export async function updatePublicCopy(root){
 for(const file of ['elysium/index.html','elysium/landing.html','elysium/app.js','elysium/purrlysium/app.js','elysium/purrlysium/solana.js']){
  const url=new URL(file,root);let text=await readFile(url,'utf8');
  for(const [before,after]of replacements)text=text.replaceAll(before,after);
  // Keep the network qualification in the existing expandable network details.
  if(file.endsWith('.js'))text=text.replace(/Elysium \$\{([^}]+)\} (?:·|\\xB7) unverified network`/g,'Elysium · ${$1}`');
  await writeFile(url,text);
 }
}
