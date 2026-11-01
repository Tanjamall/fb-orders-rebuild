import React from 'react';
import {Circle,ChevronRight} from 'lucide-react';
import type {Order,InventoryItem} from '../types';
import {orderLines,lineName} from '../services/orderLines';
export function OrderItems({order,showPrices=true}:{order:Order;showPrices?:boolean}) {
 return <div className="min-w-0 space-y-1">{orderLines(order).map((line,i)=><div key={i} className="flex min-w-0 items-baseline justify-between gap-2 text-xs"><span className="min-w-0 text-slate-800"><b className="mr-1">{line.quantity}×</b><bdi>{lineName(line)}</bdi></span>{showPrices&&<span className="shrink-0 font-mono text-[11px] text-slate-500">DH {line.salePrice.toFixed(2)}</span>}</div>)}</div>;
}
export function InventoryVariants({item,ledger=false}:{item:InventoryItem;ledger?:boolean}) {
 if(!item.variants?.length)return null;
 const colorOption=/^(colou?r|couleur|لون|اللون)$/i.test(item.variantName?.trim()||'');
 const colorFor=(label:string)=>({black:'#171717',noir:'#171717',أسود:'#171717',اسود:'#171717',blue:'#155dfb',bleu:'#155dfb',أزرق:'#155dfb',ازرق:'#155dfb',red:'#f43f5e',rouge:'#f43f5e',أحمر:'#f43f5e',احمر:'#f43f5e',white:'#fff',blanc:'#fff',أبيض:'#fff',ابيض:'#fff',green:'#16a34a',vert:'#16a34a',pink:'#ec4899',rose:'#ec4899',brown:'#92400e',marron:'#92400e',yellow:'#eab308',jaune:'#eab308'} as Record<string,string>)[label.trim().toLowerCase()];
 return <details className={ledger?'inventory-variants--ledger mt-2 border-t border-slate-100 pt-2 text-xs':'mt-2 border-t border-slate-100 pt-2 text-xs'}><summary className="cursor-pointer font-semibold text-slate-600">{ledger&&<ChevronRight className="inventory-variants__chevron" aria-hidden="true"/>}{item.variantName||'Variants'} · {item.variants.length}</summary><div className="inventory-variants__list mt-2 flex flex-wrap gap-x-3 gap-y-2">{item.variants.map(v=><div key={v.id} className="inventory-variants__pair inline-flex max-w-full items-center gap-1.5">{ledger&&colorOption&&colorFor(v.label)&&<Circle className="inventory-variants__swatch" style={{fill:colorFor(v.label),color:colorFor(v.label)==='#fff'?'#cbd5e1':colorFor(v.label)}} strokeWidth={1} aria-hidden="true"/>}<bdi className="min-w-0 break-words text-slate-600">{v.label}</bdi><span className={'inventory-variants__count rounded px-2 py-0.5 font-mono font-semibold '+(v.stock?'bg-slate-100 text-slate-800':'bg-rose-50 text-rose-700')}>{v.stock}</span></div>)}</div></details>;
}
