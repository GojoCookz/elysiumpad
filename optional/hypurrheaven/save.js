import {KEY,INITIAL,sanitize} from './state.js';
// One writer per page; reject stale tabs instead of silently overwriting another tab's progress.
export function localSave(storage){
  let raw=null,blocked=false,home=structuredClone(INITIAL),message='Saved on this browser only. No cloud account.';
  try{raw=storage.getItem(KEY);if(raw){if(raw.length>20000)throw Error('oversized');home=sanitize(JSON.parse(raw));}}catch{blocked=true;message='Save unavailable or damaged. Temporary play only; existing data is untouched. Export a snapshot to keep this session.';}
  return {home,get message(){return message;},write(value){
    if(blocked)return false;
    try{
      if(storage.getItem(KEY)!==raw){blocked=true;message='Another tab changed this home. Reload to use its save; this tab is temporary.';return false;}
      if(raw&&JSON.parse(raw).v===1&&!storage.getItem(KEY+'-before-v2'))storage.setItem(KEY+'-before-v2',raw);
      const next=JSON.stringify(sanitize(value));storage.setItem(KEY,next);raw=next;message='Saved on this browser only. No cloud account.';return true;
    }catch{message='Saving is unavailable. Keep this tab open and export a snapshot.';return false;}
  }};
}
