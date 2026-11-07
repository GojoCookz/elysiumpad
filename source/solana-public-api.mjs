// Describe only the adapter mounted at this prefix. This does not enable any
// transaction builder, change admission, or alter a transaction response.
const prefix='/api/purrlysium/solana';
export const mountedSolanaRoutes={
 'GET status':[], 'GET products':[], 'GET deployment':[], 'GET capabilities':[],
 'GET scan':['q'], 'GET launches':[], 'GET launch/state':['mint'],
 'GET portfolio':['wallet'], 'GET wallet/history':['wallet','before (optional)','limit (optional)'],
 'GET pump/quotes':[], 'POST pump/build':['wallet','mint','name','symbol','uri','quoteMint','payee'],
 'POST metadata':['name','symbol','description','image'], 'POST rpc':['jsonrpc','id','method','params'],
 'POST swap/build':['wallet','inputMint','outputMint','amount','slippageBps']
};
export function publicSolanaResponse(route,value,readiness){
 const deployment=v=>({...v,execution:'direct-pump',launchEnabled:Boolean(v.pumpCreationConfigured),
  missing:[...new Set([...readiness.launch,...readiness.trade])],launchMissing:readiness.launch,tradeMissing:readiness.trade,
  vault:{required:false,ok:null,reason:'Direct Pump creation does not use a custom pad vault.'},
  legacyVault:{programId:v.programId,contractVerified:v.contractVerified,required:false}});
 if(route==='deployment')return deployment(value);
 if(route==='products')return {...value,deployment:deployment(value.deployment)};
 if(route!=='capabilities')return value;
 return {...value,feeBuildSwitch:false,revenueBuildSwitch:false,
  launchEnabled:Boolean(value.pumpCreationConfigured),launchReadinessEndpoint:prefix+'/pump/quotes',
  pump:{...value.pump,quotesEndpoint:prefix+'/pump/quotes',buildEndpoint:prefix+'/pump/build'},
  routes:Object.fromEntries(Object.entries(mountedSolanaRoutes).map(([key,fields])=>{const [method,route]=key.split(' ');return [`${method} ${prefix}/${route}`,fields];})),
  limitations:['Pump quotes are checked individually. Every build requires fresh admission and successful simulation.','Metadata publishing requires explicit consent; signing occurs only in the connected wallet.','Swaps remain separately gated. No LaunchLab, custom-vault fee claim, or holder reward route is mounted here.','Discovery and wallet history are bounded. A configured builder is not a completed live launch.']};
}
