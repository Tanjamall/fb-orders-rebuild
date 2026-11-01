import React,{useState,useEffect,useRef,useMemo} from 'react';
import {X,Plus,Trash2,ShoppingBag,LoaderCircle} from 'lucide-react';
import type {Order,OrderLine,InventoryItem,ConfirmationMember,OrderStatus} from '../types';
import {saveOrder,readOrder} from '../services/db';
import {businessToday} from '../services/backendConfig';
import {orderLines,lineName,quoteLines} from '../services/orderLines';
import {useAuth} from '../context/AuthContext';
interface Props {isOpen:boolean;onClose:()=>void;inventory:InventoryItem[];teamMembers?:ConfirmationMember[];editingOrder?:Order|null;initialItem?:InventoryItem|null;onOrderSaved?:(order:Order)=>void;onItemUpdated?:(item:InventoryItem)=>void;}
const inputClass="w-full min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-blue-600";
const labelClass="mb-1 block text-xs font-semibold text-slate-600";
export const SaleModal:React.FC<Props>=({isOpen,onClose,inventory,teamMembers=[],editingOrder,initialItem,onOrderSaved})=>{
 const {user,profile,canViewFinancials,defaultDeliveryCharge}=useAuth();
 const [lines,setLines]=useState<OrderLine[]>([]);
 const [buyer,setBuyer]=useState(''),[phone,setPhone]=useState(''),[address,setAddress]=useState(''),[maps,setMaps]=useState(''),[notes,setNotes]=useState('');
 const [memberId,setMemberId]=useState(''),[status,setStatus]=useState<OrderStatus>('new'),[deliveryDate,setDeliveryDate]=useState('');
 const [delivery,setDelivery]=useState(0),[fees,setFees]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const initialized=useRef<string|null>(null),requestId=useRef('');
 const freshLine=(product?:InventoryItem):OrderLine=>({itemId:product?.id,itemTitle:product?.title||'',quantity:1,salePrice:product?.sellingPrice||0,basePrice:product?.sellingPrice||0,unitCost:product?.costPrice||0,variantId:product?.variants?.[0]?.id,variantLabel:product?.variants?.[0]?.label,variantName:product?.variantName});
 useEffect(()=>{
  if(!isOpen){initialized.current=null;return;}
  const key=editingOrder?.id||initialItem?.id||'new';if(initialized.current===key)return;initialized.current=key;requestId.current=editingOrder?.id||crypto.randomUUID();
  const first=initialItem||inventory.find(p=>p.status!=='archived');
  setLines(editingOrder?orderLines(editingOrder):[freshLine(first)]);
  setBuyer(editingOrder?.buyerName||'');setPhone(editingOrder?.customerPhone||'');setAddress(editingOrder?.customerAddress||'');setMaps(editingOrder?.googleMapsUrl||'');setNotes(editingOrder?.notes||'');setMemberId(editingOrder?.confirmationMemberId||'');
  setStatus(editingOrder?.status==='completed'?'delivered':editingOrder?.status||'new');setDeliveryDate(editingOrder?.deliveredDate||businessToday());setDelivery(editingOrder?.shippingCost??defaultDeliveryCharge);setFees(editingOrder?.platformFee||0);setError(null);
 },[isOpen,editingOrder?.id,initialItem?.id]);
 const patch=(index:number,value:Partial<OrderLine>)=>setLines(previous=>previous.map((l,i)=>i===index?{...l,...value}:l));
 const unchangedHistorical=!!editingOrder&&['delivered','completed'].includes(editingOrder.status)&&JSON.stringify(lines.map(l=>[l.itemId,l.variantId,l.quantity]))===JSON.stringify(orderLines(editingOrder).map(l=>[l.itemId,l.variantId,l.quantity]));
 const quoted=useMemo(()=>quoteLines(lines,inventory,unchangedHistorical),[lines,inventory,unchangedHistorical]);
 const member=teamMembers.find(m=>m.id===memberId);
 const units=quoted.reduce((n,l)=>n+l.quantity,0),revenue=quoted.reduce((n,l)=>n+l.quantity*l.salePrice,0)+(editingOrder?.shippingCharged||0);
 const costs=quoted.reduce((n,l)=>n+(l.costTotal??l.unitCost*l.quantity),0)+delivery+fees;
 const sameRewardTerms=!!editingOrder&&editingOrder.rewardStatus==='granted'&&editingOrder.confirmationMemberId===memberId&&JSON.stringify(lines.map(l=>[l.itemId,l.quantity,l.salePrice]))===JSON.stringify(orderLines(editingOrder).map(l=>[l.itemId,l.quantity,l.salePrice]));
 const reward=member?(sameRewardTerms?editingOrder!.memberReward||0:member.baseReward*(member.rewardCalculationMode==='per_item'?units:1)+quoted.reduce((n,l)=>n+Math.max(l.salePrice-(l.basePrice??l.salePrice),0)*l.quantity,0)):0;
 const profit=revenue-costs-reward;
 if(!isOpen)return null;
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();if(busy)return;
  if(!lines.length||lines.some(l=>!l.itemTitle.trim()||!Number.isInteger(l.quantity)||l.quantity<=0||!Number.isFinite(l.salePrice)||l.salePrice<0)){setError('Choose products and enter valid quantities and prices.');return;}
  setBusy(true);setError(null);
  try{
   const first=quoted[0];
   const id=await saveOrder({items:quoted,itemId:first.itemId,itemTitle:quoted.map(lineName).join(' + '),quantity:units,unitCost:first.unitCost,salePrice:first.salePrice,buyerName:buyer.trim(),customerPhone:phone.trim(),customerAddress:address.trim(),googleMapsUrl:maps.trim(),notes:notes.trim(),status,date:editingOrder?.date||businessToday(),deliveredDate:['delivered','completed'].includes(status)?deliveryDate:undefined,shippingCost:delivery,shippingCharged:editingOrder?.shippingCharged||0,platformFee:fees,paymentMethod:editingOrder?.paymentMethod||'cash',fulfillmentType:editingOrder?.fulfillmentType||'local_pickup',paymentStatus:editingOrder?.paymentStatus||'Pay on delivery',carrier:editingOrder?.carrier,trackingNumber:editingOrder?.trackingNumber,assignedToName:editingOrder?.assignedToName,confirmationMemberId:memberId||undefined,createdAt:editingOrder?.createdAt||new Date().toISOString(),createdBy:user?.uid||profile?.uid},requestId.current);
   onOrderSaved?.(await readOrder(id));onClose();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save the order.');}finally{setBusy(false);}
 };
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4">
 <section role="dialog" aria-modal="true" aria-labelledby="order-editor-title" className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
 <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4"><div className="flex items-center gap-3"><ShoppingBag className="text-blue-600" size={22}/><h2 id="order-editor-title" className="font-bold text-slate-900">{editingOrder?'Edit order':'New order'}</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close order form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button></header>
 <form onSubmit={submit} className="space-y-4 overflow-y-auto p-4 sm:p-5">
 {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
 <div className="space-y-3">{lines.map((line,index)=>{
 const product=inventory.find(p=>p.id===line.itemId);
 return <div key={index} className="grid grid-cols-6 gap-2 rounded-xl border border-slate-200 p-3">
 <label className="col-span-6 sm:col-span-3"><span className={labelClass}>Product</span><select aria-label={'Product '+(index+1)} className={inputClass} value={line.itemId||''} onChange={e=>patch(index,freshLine(inventory.find(p=>p.id===e.target.value)))}><option value="">Custom item</option>{inventory.filter(p=>p.status!=='archived'||p.id===line.itemId).map(p=><option key={p.id} value={p.id}>{p.title} · {p.stock} in stock</option>)}</select></label>
 {product?.variants?.length?<label className="col-span-3"><span className={labelClass}>{product.variantName||'Variant'}</span><select aria-label={'Variant '+(index+1)} className={inputClass} value={line.variantId||''} onChange={e=>patch(index,{variantId:e.target.value,variantLabel:product.variants?.find(v=>v.id===e.target.value)?.label})}><option value="">Select</option>{product.variants.map(v=><option key={v.id} value={v.id}>{v.label} · {v.stock} left</option>)}{line.variantId&&!product.variants.some(v=>v.id===line.variantId)&&<option value={line.variantId}>{line.variantLabel||'Previous variant'}</option>}</select></label>:null}
 {!line.itemId&&<label className="col-span-6 sm:col-span-3"><span className={labelClass}>Item name</span><input aria-label={'Item name '+(index+1)} required value={line.itemTitle} onChange={e=>patch(index,{itemTitle:e.target.value})} className={inputClass}/></label>}
 <label className="col-span-2"><span className={labelClass}>Qty</span><input aria-label={'Quantity '+(index+1)} type="number" min="1" step="1" required value={line.quantity} onChange={e=>patch(index,{quantity:Number(e.target.value)})} className={inputClass}/></label>
 <label className="col-span-3"><span className={labelClass}>Sell (DH)</span><input aria-label={'Sale price '+(index+1)} type="number" min="0" step="0.01" required value={line.salePrice} onChange={e=>patch(index,{salePrice:Number(e.target.value)})} className={inputClass}/></label>
 <div className="flex items-end justify-end"><button type="button" aria-label={'Remove item '+(index+1)} disabled={lines.length===1||busy} onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))} className="min-h-10 rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30"><Trash2 size={18}/></button></div>
 {!line.itemId&&canViewFinancials&&<label className="col-span-3"><span className={labelClass}>Unit cost (DH)</span><input type="number" min="0" step="0.01" value={line.unitCost} onChange={e=>patch(index,{unitCost:Number(e.target.value)})} className={inputClass}/></label>}
 </div>})}</div>
 <button type="button" onClick={()=>setLines(old=>[...old,freshLine(inventory.find(p=>p.status!=='archived'))])} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus size={16}/>Add item</button>
 <div className="grid grid-cols-2 gap-3">
 <label><span className={labelClass}>Customer name</span><input aria-label="Customer name" required value={buyer} onChange={e=>setBuyer(e.target.value)} className={inputClass}/></label>
 <label><span className={labelClass}>Phone number</span><input aria-label="Phone number" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className={inputClass}/></label>
 <label><span className={labelClass}>Address</span><input aria-label="Address" value={address} onChange={e=>setAddress(e.target.value)} className={inputClass}/></label>
 <label><span className={labelClass}>Maps link</span><input aria-label="Maps link" type="url" value={maps} onChange={e=>setMaps(e.target.value)} className={inputClass}/></label>
 <label><span className={labelClass}>Confirmed by</span><select aria-label="Confirmed by" value={memberId} onChange={e=>setMemberId(e.target.value)} className={inputClass}><option value="">No agent</option>{teamMembers.filter(m=>m.status==='active'||m.id===memberId).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
 <label><span className={labelClass}>Other expenses (DH)</span><input aria-label="Other expenses" type="number" min="0" step="0.01" value={fees} onChange={e=>setFees(Number(e.target.value))} className={inputClass}/></label>
 <label><span className={labelClass}>Delivery cost (DH)</span><input aria-label="Delivery cost" type="number" min="0" step="0.01" value={delivery} onChange={e=>setDelivery(Number(e.target.value))} className={inputClass}/></label>
 <label><span className={labelClass}>Status</span><select aria-label="Order status" value={status} onChange={e=>setStatus(e.target.value as OrderStatus)} className={inputClass}><option value="new">New</option><option value="confirmed">Confirmed</option><option value="shipped">Out for delivery</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label>
 {status==='delivered'&&<label className="col-span-2"><span className={labelClass}>Delivered date</span><input aria-label="Delivered date" type="date" required value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} className={inputClass}/></label>}
 </div>
 <label className="block"><span className={labelClass}>Notes</span><textarea aria-label="Order notes" value={notes} onChange={e=>setNotes(e.target.value)} rows={2} className={inputClass}/></label>
 {canViewFinancials&&<div className={'grid gap-3 rounded-2xl bg-slate-900 p-4 text-white '+(member?'grid-cols-2 sm:grid-cols-4':'grid-cols-3')}>
 <div><span className="block text-[10px] font-bold uppercase text-slate-400">Total due</span><strong className="text-blue-300">DH {revenue.toFixed(2)}</strong></div>
 <div><span className="block text-[10px] font-bold uppercase text-slate-400">Cost &amp; fees</span><strong className="text-rose-300">DH {costs.toFixed(2)}</strong></div>
 {member&&<div><span className="block text-[10px] font-bold uppercase text-slate-400">Agent reward</span><strong className="text-amber-300">−DH {reward.toFixed(2)}</strong></div>}
 <div><span className="block text-[10px] font-bold uppercase text-slate-400">Projected profit</span><strong className={profit>=0?'text-emerald-400':'text-rose-300'}>DH {profit.toFixed(2)}</strong><small className="block text-[10px] text-slate-400">{revenue?(profit/revenue*100).toFixed(1):'0'}% margin</small></div>
 </div>}
 <footer className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy&&<LoaderCircle size={16} className="animate-spin"/>}{busy?'Saving…':editingOrder?'Update order':'Save order'}</button></footer>
 </form></section></div>;
};
