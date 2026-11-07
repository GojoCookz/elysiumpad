// Resolve the same browser module instance used by the header, never a Phantom fallback.
export async function getBrowserWallet(){
 const path='/terminal-shell.mjs',shell=await import(path);
 await shell.connectTerminalWallet();const wallet=shell.selectedWallet();
 if(!wallet?.publicKey||!wallet.signTransaction)throw new Error('Choose a connected Solana wallet before reviewing.');
 return wallet;
}
