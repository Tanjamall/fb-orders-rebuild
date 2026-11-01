import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadExport,prepareSnapshot,cents} from './rehearse-import.mjs';

export function targetPlan(source,ownerId) {
 const snapshot=prepareSnapshot(source),t=source.tables;
 const status={New:'new',Confirmed:'confirmed','Out for delivery':'shipped',Delivered:'delivered',Canceled:'cancelled'};
 const current=new Map(t.products.map(p=>[p.id,p]));
 const profiles=new Map(t.profiles.map(p=>[p.id,p.display_name||'Team member']));
 const employeeMap=new Map(t.confirmation_employees.map(e=>[e.id,e]));
 const asDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 const timestamp=new Date(source.exportedAt).toISOString();
 const keyUUID=value=>{const h=crypto.createHash('sha256').update(value).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32);};
 const countFor=w=>t.orders.filter(o=>o.workspace_id===w).length;
 const workspaces=t.workspaces.map(w=>({id:w.id,name:w.name,created_at:w.created_at,default_delivery_charge:Number(w.default_delivery_charge||0),currency:'MAD',source_project:'tsoqghvuxnoljfsbzuip',source_order_count:countFor(w.id)}));
 const employees=t.confirmation_employees.map(e=>({id:e.id,workspace_id:e.workspace_id,name:e.name,phone:null,email:null,base_reward:e.bonus_per_confirmation,reward_trigger:status[e.bonus_earned_stage]||'delivered',reward_calculation_mode:e.bonus_basis||'per_order',status:e.active?'active':'inactive',total_paid:0,notes:null,created_at:e.created_at,updated_at:e.created_at,created_by:ownerId}));
 const inventory=t.products.map(p=>{
  const batches=t.inventory_batches.filter(b=>b.product_id===p.id).sort((a,b)=>Date.parse(a.received_at)-Date.parse(b.received_at)||Number(a.fifo_position)-Number(b.fifo_position)).map((b,index)=>({id:b.id,batchNumber:index+1,receivedDate:asDate(b.received_at),initialQty:b.original_quantity,remainingQty:b.remaining_quantity,costPrice:b.unit_cost,sellingPrice:p.price,sellingPriceKnown:false,source:b.source,sourceFifoPosition:b.fifo_position,createdAt:b.created_at}));
  const isBundle=!!p.components?.length;
  const parts=isBundle?p.components.map(c=>({itemId:c.productId,itemTitle:current.get(c.productId)?.name||'Deleted product',quantity:c.quantity,unitCost:current.get(c.productId)?.cost||0,unitPrice:current.get(c.productId)?.price||0})):[];
  const stock=isBundle?Math.min(...parts.map(c=>Math.floor((current.get(c.itemId)?.stock||0)/c.quantity))):p.stock;
  return {id:p.id,workspace_id:p.workspace_id,title:p.name,sku:null,category:'Imported',condition:'new',cost_price:isBundle?parts.reduce((n,c)=>n+(c.unitCost||0)*c.quantity,0):p.cost,selling_price:p.price,stock,low_stock_threshold:p.low_stock_at??3,vendor_id:null,vendor_name:null,listing_url:null,status:p.archived?'archived':stock>0?'active':'out_of_stock',fulfillment_type:'both',notes:null,is_bundle:isBundle,bundle_items:parts,batches,created_at:p.created_at,updated_at:p.created_at,created_by:ownerId,variants:p.variants||[],variant_name:p.variant_name||'Color',historical_placeholder:false};
 });
 for(const placeholder of snapshot.historical_product_placeholders){
  const dates=t.orders.filter(o=>o.items.some(i=>i.productId===placeholder.id)).map(o=>o.created_at).sort();
  inventory.push({id:placeholder.id,workspace_id:placeholder.workspace_id,title:'Deleted product',sku:null,category:'Imported',condition:'new',cost_price:0,selling_price:0,stock:0,low_stock_threshold:0,vendor_id:null,vendor_name:null,listing_url:null,status:'archived',fulfillment_type:'both',notes:null,is_bundle:false,bundle_items:[],batches:[],created_at:dates[0]||timestamp,updated_at:dates[0]||timestamp,created_by:ownerId,variants:[],variant_name:'Color',historical_placeholder:true});
 }
 const orders=t.orders.map(o=>{
  const prepared=snapshot.orders.find(p=>p.id===o.id);
  const member=employeeMap.get(o.confirmation_employee_id);
  const basePrices=o.confirmation_base_prices;
  const lines=o.items.map((line,index)=>{
   const product=current.get(line.productId);
   const base=Array.isArray(basePrices)?basePrices[index]:(basePrices?.[line.productId]);
   const basePrice=typeof base==='number'?base:typeof base?.basePrice==='number'?base.basePrice:product?.price??line.unitPrice;
   const unitCost=typeof line.costTotal==='number'?line.costTotal/line.quantity:product?.cost||0;
   return {itemId:line.productId,itemTitle:product?.name||'Deleted product',quantity:line.quantity,salePrice:line.unitPrice,unitCost,costTotal:typeof line.costTotal==='number'?line.costTotal:unitCost*line.quantity,basePrice,variantId:line.variantId||null,variantLabel:line.variantLabel||null,variantName:line.variantName||product?.variant_name||null};
  });
  const quantity=lines.reduce((n,l)=>n+l.quantity,0);
  const revenue=prepared.revenue_cents/100;
  const productCost=prepared.recorded_product_cost_cents===null?lines.reduce((n,l)=>n+l.costTotal,0):prepared.recorded_product_cost_cents/100;
  const reward=prepared.employee_reward_cents/100;
  const totalCost=productCost+prepared.delivery_cost_cents/100+prepared.other_cost_cents/100;
  const net=o.status==='Canceled'?0:revenue-totalCost-reward;
  const eligible=!!member&&o.status!=='Canceled'&&(['New','Confirmed','Out for delivery','Delivered'].indexOf(o.status)>=['New','Confirmed','Out for delivery','Delivered'].indexOf(member.bonus_earned_stage||'Delivered'));
  const allocations=t.order_cost_allocations.filter(a=>a.order_id===o.id).map(a=>({productId:a.stock_product_id,batchId:a.batch_id,quantity:a.quantity,costPrice:a.unit_cost,lineIndex:a.order_item_index,variantId:lines[a.order_item_index]?.variantId||null}));
  return {id:o.id,workspace_id:o.workspace_id,item_id:lines[0].itemId,item_title:lines.map(l=>l.itemTitle+(l.variantLabel?' · '+l.variantLabel:'')).join(' + '),quantity,unit_cost:productCost/quantity,sale_price:revenue/quantity,shipping_charged:0,shipping_cost:prepared.delivery_cost_cents/100,platform_fee:prepared.other_cost_cents/100,total_revenue:revenue,total_cost:totalCost,net_profit:Math.round(net*100)/100,profit_margin:revenue?net/revenue*100:0,buyer_name:o.client_name||'',customer_phone:o.phone,customer_address:o.address,google_maps_url:o.location_url,payment_method:'cash',fulfillment_type:'local_pickup',carrier:null,tracking_number:null,status:status[o.status],date:asDate(o.created_at),delivered_date:o.status==='Delivered'?asDate(o.delivered_at||o.created_at):null,delivered_at:o.delivered_at,notes:o.notes,created_at:o.created_at,created_by:ownerId,confirmation_member_id:o.confirmation_employee_id,confirmation_member_name:member?.name||null,base_price:lines.reduce((n,l)=>n+l.basePrice*l.quantity,0)/quantity,member_reward:reward,member_extra_reward:Number(o.confirmation_extra_bonus||0),reward_trigger:member?status[member.bonus_earned_stage]||'delivered':null,reward_status:o.status==='Canceled'?'cancelled':eligible?'granted':'pending',reward_calculation_mode:member?.bonus_basis||null,stock_allocations:allocations,items:lines,payment_status:o.payment_status||'Pay on delivery',assigned_to_name:profiles.get(o.assigned_to)||null,source_project:'tsoqghvuxnoljfsbzuip',legacy_settlement_unknown:eligible&&reward>0};
 });
 const daily=t.daily_delivery_costs.map(c=>({id:keyUUID('daily:'+c.workspace_id+':'+c.cost_date),workspace_id:c.workspace_id,date:c.cost_date,amount:c.amount,created_at:timestamp}));
 const kinds={opening_balance:'restock',restock:'restock',sale:'delivery',return:'reversal',correction:'correction'};
 const movements=t.inventory_movements.map(m=>({id:m.id,workspace_id:m.workspace_id,product_id:m.product_id,order_id:m.order_id,quantity:m.quantity_change,cost:m.unit_cost,kind:kinds[m.movement_type],created_at:m.created_at,created_by:ownerId,source_kind:m.movement_type,batch_id:m.batch_id,details:{sourceOrderItemIndex:m.order_item_index}}));
 const target={workspaces,employees,inventory,orders,daily,movements};
 const rows=[];
 for(const [table,records] of Object.entries(t))records.forEach((payload,row_number)=>rows.push({table_name:table,row_number,payload}));
 for(const [table,records] of Object.entries(target))records.forEach((payload,row_number)=>rows.push({table_name:'_target_'+table,row_number,payload}));
 rows.push({table_name:'_expected',row_number:0,payload:{counts:{workspaces:workspaces.length,employees:employees.length,inventory:inventory.length,orders:orders.length,daily:daily.length,movements:movements.length},monthly:snapshot.monthly_totals,sourceSnapshot:source.exportedAt,sourceHash:source.sha256,sourceProject:'tsoqghvuxnoljfsbzuip'}});
 return {sourceHash:source.sha256,ownerId,rows,target,expected:snapshot.monthly_totals};
}
