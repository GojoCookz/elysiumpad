import {mountCreator as mountLaunchlab} from './creator-client.mjs';
import {mountPumpCreator} from './pump-creator.mjs';
export function mountCreator(options){
 if(document.documentElement.dataset.brand!=='getrektd'&&new URLSearchParams(location.search).get('brand')!=='getrektd')return mountLaunchlab(options);
 const label=document.createElement('label');label.htmlFor='launch-provider';label.textContent='Launch on';const select=document.createElement('select');select.id=label.htmlFor;
 for(const [value,text]of [['pump','Pump.fun'],['launchlab','LaunchLab · advanced']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
 const note=document.createElement('p');note.textContent='HypurrLabs launches Solana tokens. HYPE/xHYPE, xBTC and xSOL quote support is verified per protocol, never assumed. The saved LaunchLab adapter is our own deployment path, not an authenticated StonkFun API integration.';
 const row=document.createElement('div');row.className='launch-provider-row';row.append(label,select);const help=document.createElement('details');help.className='launch-provider-help';const summary=document.createElement('summary');summary.textContent='About the launch providers';help.append(summary,note);
 const panel=document.createElement('section');panel.setAttribute('aria-label','Selected launch provider');options.target.replaceChildren(row,panel,help);let controller;
 function mount(){controller?.destroy?.();controller?.cancel?.();const selected=select.value;const args={...options,target:panel,isActive:()=>select.value===selected&&options.isActive()};controller=selected==='pump'?mountPumpCreator(args):mountLaunchlab(args);}
 select.addEventListener('change',mount);mount();return {update(){controller?.update();},cancel(){controller?.cancel();}};
}
