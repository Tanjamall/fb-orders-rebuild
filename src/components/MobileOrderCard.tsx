import React,{useEffect,useRef,useState} from 'react';
import {IconBrandWhatsapp,IconCalendarWeek,IconCheck,IconChevronDown,IconCopy,IconDotsVertical,IconExternalLink,IconMapPin,IconMessage2,IconLocation,IconPencil,IconRefresh,IconTrash,IconUserCheck} from '@tabler/icons-react';
import type {Order,OrderStatus} from '../types';
import {lineName,orderLines} from '../services/orderLines';
import {whatsappUrl} from '../services/phone';
import './MobileOrderCard.css';
type CardStatus='new'|'confirmed'|'delivered'|'cancelled';
interface Props{order:Order;status:CardStatus;carryOver?:string|null;canEdit:boolean;canDelete:boolean;canViewFinancials:boolean;copied?:boolean;onCopy:(address:string,id:string)=>void;onEdit:(order:Order)=>void;onDelete:(order:Order)=>void;onStatusChange:(order:Order,status:OrderStatus)=>Promise<void>|void;}
const dateLabel=(value:string)=>{const date=new Date(value+'T12:00:00Z');return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(date);};
const amount=(value:number)=>(Number.isFinite(value)?value:0).toFixed(2);
export function MobileOrderCard({order,status,carryOver,canEdit,canDelete,canViewFinancials,copied,onCopy,onEdit,onDelete,onStatusChange}:Props){
 const [menuOpen,setMenuOpen]=useState(false),[changing,setChanging]=useState(false);
 const menu=useRef<HTMLDivElement>(null),menuButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!menuOpen)return;const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))setMenuOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMenuOpen(false);menuButton.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[menuOpen]);
 const lines=orderLines(order),phone=order.customerPhone||'';
 const formattedPhone=phone.replace(/^\+212(\d{3})(\d{3})(\d{3})$/,'+212 $1 $2 $3');
 const whatsapp=whatsappUrl(phone),maps=order.googleMapsUrl||(order.customerAddress?'https://maps.google.com/?q='+encodeURIComponent(order.customerAddress):null);
 const date=status==='delivered'?(order.deliveredDate||order.date):order.date;
 const rewardState=status==='cancelled'?'Void':order.legacySettlementUnknown?'Recorded bonus':order.rewardStatus==='granted'?'Earned':'Pending';
 return <article className="mobile-order-card" data-can-open={canEdit} aria-label={'Order for '+(order.buyerName||'Facebook Customer')} onClick={()=>{if(canEdit)onEdit(order);}}>
 <div className="mobile-order-card__grid">
  <div className="mobile-order-card__products">{lines.map((line,index)=><div key={index} className="mobile-order-card__product"><span className="mobile-order-card__quantity">{line.quantity} ×</span><bdi title={lineName(line)}>{lineName(line)}</bdi></div>)}</div>
  <span className="mobile-order-card__money" aria-label="Order total">DH {amount(order.totalRevenue)}</span>
  {canViewFinancials?<span className={'mobile-order-card__money mobile-order-card__profit'+(order.netProfit<0?' is-negative':'')} aria-label="Order net profit">{order.netProfit<0?'−':'+'}DH {amount(Math.abs(order.netProfit))}</span>:<span aria-hidden="true"/>}
  <span className="mobile-order-card__name" title={order.buyerName}>{order.buyerName||'Facebook Customer'}</span>
  {phone?<a className="mobile-order-card__phone" href={'tel:'+phone} onClick={e=>e.stopPropagation()} title={'Call '+phone}>{formattedPhone}</a>:<span/>}
  {whatsapp?<a className="mobile-order-card__whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={'WhatsApp '+phone} title="Open WhatsApp" onClick={e=>e.stopPropagation()}><span><IconBrandWhatsapp size={21} stroke={2.1} aria-hidden="true"/></span></a>:<span/>}
 </div>
 {(order.customerAddress||maps)&&<div className="mobile-order-card__location" onClick={e=>e.stopPropagation()}><IconMapPin size={17} stroke={1.8} aria-hidden="true"/><span className="mobile-order-card__address" title={order.customerAddress}>{order.customerAddress||'Delivery location'}</span><div className="mobile-order-card__location-actions">{maps&&<a className="mobile-order-card__map" href={maps} target="_blank" rel="noopener noreferrer" aria-label="Open on Google Maps"><IconLocation size={15} stroke={1.8} aria-hidden="true"/>Map<IconExternalLink size={13} stroke={1.8} aria-hidden="true"/></a>}</div></div>}
 {order.notes&&<div className="mobile-order-card__note"><IconMessage2 size={16} stroke={1.8} aria-hidden="true"/><p>{order.notes}</p></div>}
 {order.confirmationMemberName&&<div className="mobile-order-card__agent"><IconUserCheck size={15} stroke={1.8} aria-hidden="true"/><span>{order.confirmationMemberName}</span>{canViewFinancials&&<strong>DH {amount(order.memberReward||0)}</strong>}<small>{rewardState}</small></div>}
 <footer className="mobile-order-card__footer" onClick={e=>e.stopPropagation()}>
  <div className={'mobile-order-card__status is-'+status}><select aria-label="Order status" value={status} disabled={!canEdit||changing} onChange={async e=>{const next=e.target.value as OrderStatus;setChanging(true);try{await onStatusChange(order,next);}finally{setChanging(false);}}}><option value="new">New</option><option value="confirmed">Confirmed</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select><IconChevronDown size={14} stroke={1.8} aria-hidden="true"/></div>
  <div className="mobile-order-card__dates"><span className="mobile-order-card__date" title={(status==='delivered'?'Delivered: ':'Ordered: ')+date}><IconCalendarWeek size={15} stroke={1.8} aria-hidden="true"/>{dateLabel(date)}</span>{carryOver&&<span className="mobile-order-card__carry"><IconRefresh size={15} stroke={1.8} aria-hidden="true"/>{carryOver}</span>}</div>
  {(canEdit||canDelete||order.customerAddress)&&<div ref={menu} className="mobile-order-card__menu"><button ref={menuButton} type="button" aria-label="Order actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)} className="mobile-order-card__menu-button"><IconDotsVertical size={19} stroke={1.9}/></button>{menuOpen&&<div role="menu" aria-label="Order actions" className="mobile-order-card__menu-list">{order.customerAddress&&<button role="menuitem" type="button" onClick={()=>{onCopy(order.customerAddress!,order.id);setMenuOpen(false);}}>{copied?<IconCheck size={16} stroke={1.8}/>:<IconCopy size={16} stroke={1.8}/>}Copy address</button>}{canEdit&&<button role="menuitem" type="button" onClick={()=>{setMenuOpen(false);onEdit(order);}}><IconPencil size={16} stroke={1.8}/>Edit order</button>}{canDelete&&<button role="menuitem" type="button" className="is-destructive" onClick={()=>{setMenuOpen(false);onDelete(order);}}><IconTrash size={16} stroke={1.8}/>Delete order</button>}</div>}</div>}
 </footer>
 </article>;
}
