import React,{useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Truck,X,LoaderCircle,CheckCircle2} from 'lucide-react';
import {businessToday} from '../services/backendConfig';
import {saveDailyDeliveryCost} from '../services/db';
import {useAuth} from '../context/AuthContext';
import type {DailyDeliveryCost} from '../types';
export function DailyDeliveryEditor({costs}:{costs:DailyDeliveryCost[]}) {
 const dialog=useRef<HTMLDivElement>(null);
 const {defaultDeliveryCharge,setDefaultDeliveryCharge,canViewFinancials}=useAuth();
 const [open,setOpen]=useState(false),[date,setDate]=useState(businessToday()),[amount,setAmount]=useState(0),[deliveryDefault,setDeliveryDefault]=useState(defaultDeliveryCharge),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[busy,setBusy]=useState<'daily'|'default'|null>(null);
 useEffect(()=>{if(open){setAmount(costs.find(c=>c.date===date)?.amount||0);setMessage('');}},[date,open]);
 useEffect(()=>setDeliveryDefault(defaultDeliveryCharge),[defaultDeliveryCharge]);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const panel=dialog.current;panel?.querySelector<HTMLButtonElement>('button')?.focus();
  const keydown=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();if(!busy)setOpen(false);}
   if(e.key==='Tab'&&panel){const fields=Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]'));const first=fields[0],last=fields[fields.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  };
  document.addEventListener('keydown',keydown);
  return()=>{document.removeEventListener('keydown',keydown);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
 },[open,busy]);
 if(!canViewFinancials)return null;
 const save=async(kind:'daily'|'default')=>{setBusy(kind);setMessage('');setFailed(false);try{if(kind==='daily')await saveDailyDeliveryCost(date,amount);else await setDefaultDeliveryCharge(deliveryDefault);setMessage(kind==='daily'?'Daily delivery cost saved.':'Default delivery cost saved.');}catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Unable to save. Please try again.');}finally{setBusy(null);}};
 const input='mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100';
 const button='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm shadow-blue-600/15 transition hover:bg-blue-700 disabled:opacity-50';
 return <>
 <button type="button" aria-label="End-of-day delivery cost" title="End-of-day delivery cost" aria-haspopup="dialog" aria-expanded={open} aria-controls="delivery-cost-editor" onClick={()=>setOpen(true)} className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-xs transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"><Truck className="h-4 w-4"/></button>
 {open&&createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false);}}>
 <div ref={dialog} id="delivery-cost-editor" role="dialog" aria-modal="true" aria-labelledby="delivery-cost-title" className="max-h-[calc(100dvh_-_2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl">
 <div className="bg-white">
 <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Truck size={18}/></span><h2 id="delivery-cost-title" className="min-w-0 flex-1 text-base font-bold">End-of-day delivery cost</h2><button type="button" aria-label="Close delivery costs" disabled={busy!==null} onClick={()=>setOpen(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X size={18}/></button></header>
 <div className="space-y-4 px-4 py-4 sm:px-5">
 <form onSubmit={e=>{e.preventDefault();void save('daily');}} className="grid grid-cols-2 items-end gap-3">
 <label className="min-w-0 text-xs font-semibold text-slate-500">Date<input aria-label="Delivery cost date" type="date" required value={date} onChange={e=>setDate(e.target.value)} className={input}/></label>
 <label className="min-w-0 text-xs font-semibold text-slate-500">Shared cost (DH)<input aria-label="Shared delivery cost" type="number" inputMode="decimal" min="0" step="0.01" required value={amount} onChange={e=>setAmount(Number(e.target.value))} className={input}/></label>
 <button disabled={busy!==null} className={button+' col-span-2'}>{busy==='daily'&&<LoaderCircle size={16} className="animate-spin"/>}Save daily cost</button>
 </form>
 <form onSubmit={e=>{e.preventDefault();void save('default');}} className="flex items-end gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
 <label className="min-w-0 flex-1 text-xs font-semibold text-slate-500">Default cost per new order (DH)<input aria-label="Default order delivery cost" type="number" inputMode="decimal" min="0" step="0.01" required value={deliveryDefault} onChange={e=>setDeliveryDefault(Number(e.target.value))} className={input}/></label>
 <button disabled={busy!==null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50">{busy==='default'&&<LoaderCircle size={16} className="animate-spin"/>}Save</button>
 </form>
 {message&&<p role={failed?'alert':'status'} className={'flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium '+(failed?'bg-rose-50 text-rose-700':'bg-emerald-50 text-emerald-700')}>{!failed&&<CheckCircle2 size={17} className="mt-0.5 shrink-0"/>}{message}</p>}
 </div>
 </div>
 </div>
 </div>,document.body)}
 </>;
}
