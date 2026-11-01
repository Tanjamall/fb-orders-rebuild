import React,{useEffect,useState} from 'react';
import {inventoryHistory} from '../services/db';
import {isDemo} from '../supabase';
export function InventoryAudit({productId}:{productId:string}) {
 const [history,setHistory]=useState<{movements:any[];corrections:any[]}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;setHistory(null);setError('');if(!isDemo)inventoryHistory(productId).then(data=>{if(alive)setHistory(data);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[productId]);
 if(isDemo)return null;
 if(error)return <p role="alert" className="text-sm text-rose-700">{error}</p>;
 if(!history)return <p role="status" className="text-sm text-slate-500">Loading inventory history…</p>;
 return <div className="space-y-4"><section><h3 className="mb-2 text-xs font-bold uppercase text-slate-500">Stock movements · {history.movements.length}</h3><div className="max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">{history.movements.map(m=><div key={m.id} className="flex justify-between gap-3 p-3 text-xs"><div><b className="text-slate-700">{m.source_kind||m.kind}</b><span className="mt-1 block text-slate-500">{new Date(m.created_at).toLocaleDateString('en-GB')}</span></div><div className="text-right font-mono"><b className={m.quantity>=0?'text-emerald-700':'text-slate-700'}>{m.quantity>0?'+':''}{m.quantity}</b><span className="mt-1 block text-slate-500">DH {Number(m.cost||0).toFixed(2)} / unit</span></div></div>)}{!history.movements.length&&<p className="p-3 text-xs text-slate-500">No stock movements recorded.</p>}</div></section>
 {history.corrections.length>0&&<section><h3 className="mb-2 text-xs font-bold uppercase text-slate-500">Inventory corrections</h3><div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{history.corrections.map(c=><div key={c.id} className="space-y-1 p-3 text-xs text-slate-600"><b>{new Date(c.created_at).toLocaleDateString('en-GB')}</b><p>Stock {c.old_stock} → {c.new_stock} · Cost DH {Number(c.old_active_cost).toFixed(2)} → {Number(c.new_active_cost).toFixed(2)}</p>{c.note&&<p>{c.note}</p>}</div>)}</div></section>}</div>;
}
