import type {Order} from '../types';
export type OrderPeriod='this_month'|'today'|'last_month'|'all';
const unfinished=new Set(['new','confirmed','pending_pickup','shipped']);
export function isCarryOver(order:Order,month:string):boolean {
 const created=order.date||order.createdAt?.slice(0,10)||'';
 return unfinished.has(order.status)&&/^\d{4}-\d{2}-\d{2}$/.test(created)&&created.slice(0,7)<month;
}
export function matchesOrderPeriod(order:Order,period:OrderPeriod,today:string):boolean {
 const date=(['delivered','completed'].includes(order.status)?order.deliveredDate:undefined)||order.date||order.createdAt?.slice(0,10)||'';
 if(period==='all'||!date)return true;
 if(period==='today')return date===today;
 if(period==='this_month')return date.startsWith(today.slice(0,7))||isCarryOver(order,today.slice(0,7));
 const previous=new Date(today.slice(0,7)+'-01T12:00:00Z');previous.setUTCMonth(previous.getUTCMonth()-1);
 return date.startsWith(previous.toISOString().slice(0,7));
}
export function carryOverLabel(order:Order,month:string):string|null {
 if(!isCarryOver(order,month))return null;
 const created=(order.date||order.createdAt!.slice(0,10)).slice(0,7);
 const label=new Intl.DateTimeFormat('en-GB',{month:'short',...(created.slice(0,4)!==month.slice(0,4)?{year:'numeric' as const}:{}),timeZone:'UTC'}).format(new Date(created+'-01T12:00:00Z'));
 return 'Carried over · '+label;
}
