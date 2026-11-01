import React from 'react';
import type {Order,InventoryItem} from '../types';
import {orderLines,lineName} from '../services/orderLines';
export function OrderItems({order,showPrices=true}:{order:Order;showPrices?:boolean}) {
 return <div className="min-w-0 space-y-1">{orderLines(order).map((line,i)=><div key={i} className="flex min-w-0 items-baseline justify-between gap-2 text-xs"><span className="min-w-0 text-slate-800"><b className="mr-1">{line.quantity}×</b><bdi>{lineName(line)}</bdi></span>{showPrices&&<span className="shrink-0 font-mono text-[11px] text-slate-500">DH {line.salePrice.toFixed(2)}</span>}</div>)}</div>;
}
export function InventoryVariants({item}:{item:InventoryItem}) {
 if(!item.variants?.length)return null;
 return <details className="mt-2 border-t border-slate-100 pt-2 text-xs"><summary className="cursor-pointer font-semibold text-slate-600">{item.variantName||'Variants'} · {item.variants.length}</summary><div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">{item.variants.map(v=><div key={v.id} className="inline-flex max-w-full items-center gap-1.5"><bdi className="min-w-0 break-words text-slate-600">{v.label}</bdi><span className={'rounded px-2 py-0.5 font-mono font-semibold '+(v.stock?'bg-slate-100 text-slate-800':'bg-rose-50 text-rose-700')}>{v.stock}</span></div>)}</div></details>;
}
