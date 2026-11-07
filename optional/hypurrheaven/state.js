import {freshFishing,sanitizeFishing} from './fishing-state.js';
export const KEY = 'hypurrheaven-home-v1';
export const OUTFITS = ['Pink bow','Star wand','Bubble tea','Cloud jumper','Little crown','Headphones','Flower wreath','Bunny hood','Lilac cardigan','Heart balloon','Red scarf','Paintbrush','Satchel','Strawberry','Witch hat','Star necklace'];
export const PIECES = {sofa:'Cloud sofa',table:'Tea table',plant:'Pearl fern',lamp:'Star lamp',rug:'Petal rug',shelf:'Keepsake shelf'};
export const INITIAL = {v:2,name:'Cloud guest',outfit:0,fur:'teal',eyes:'blue',palette:'teal',fishing:freshFishing(),items:[{type:'rug',x:176,y:208},{type:'sofa',x:112,y:160},{type:'table',x:176,y:184},{type:'plant',x:288,y:136},{type:'lamp',x:80,y:136},{type:'shelf',x:256,y:160}]};
const oneOf = (value, list, fallback) => list.includes(value) ? value : fallback;
export function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![1,2].includes(raw.v)) throw new Error('This home link uses an unsupported format.');
  return {v:2,name:typeof raw.name==='string'?raw.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,20)||'Cloud guest':'Cloud guest',outfit:Number.isInteger(raw.outfit)&&raw.outfit>=0&&raw.outfit<16?raw.outfit:0,fur:oneOf(raw.fur,['teal','pearl','lilac'],'teal'),eyes:oneOf(raw.eyes,['blue','rose','green'],'blue'),palette:oneOf(raw.palette,['teal','rose','lavender'],'teal'),fishing:sanitizeFishing(raw.fishing),items:Array.isArray(raw.items)?raw.items.slice(0,24).filter(i=>i&&Object.hasOwn(PIECES,i.type)&&Number.isFinite(i.x)&&Number.isFinite(i.y)).map(i=>({type:i.type,x:Math.max(64,Math.min(320,Math.round(i.x/8)*8)),y:Math.max(132,Math.min(248,Math.round(i.y/8)*8))})):[]};
}
export function encode(home){const bytes=new TextEncoder().encode(JSON.stringify(sanitize(home)));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function decode(value){if(value.length>12000||!/^[\w-]+$/.test(value))throw new Error('This home link is damaged or too large.');try{return sanitize(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)))));}catch{throw new Error('This home link could not be opened. Your saved home is safe.');}}
