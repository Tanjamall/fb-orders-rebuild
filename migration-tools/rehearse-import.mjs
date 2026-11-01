import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { PGlite } from '@electric-sql/pglite';

export const businessTables = ['workspaces','profiles','workspace_members','products','orders','confirmation_employees','inventory_batches','order_cost_allocations','inventory_movements','inventory_corrections','daily_delivery_costs'];

export function loadExport(file) {
 const raw=fs.readFileSync(file);
 const parsed=Papa.parse(raw.toString('utf8').replace(/^\uFEFF/,''),{header:true,skipEmptyLines:true});
 if(parsed.errors.length)throw Error('Invalid CSV export');
 const tables={}; const times=new Set();
 for(const row of parsed.data) {
  if(row.format!=='tanger-business-export-v1'||row.source_project!=='tsoqghvuxnoljfsbzuip')throw Error('Unexpected source or format');
  if(Object.hasOwn(tables,row.table_name))throw Error('Duplicate exported table');
  const data=JSON.parse(row.data);
  if(!Array.isArray(data)||!Number.isSafeInteger(Number(row.row_count))||data.length!==Number(row.row_count))throw Error('Incomplete export: '+row.table_name);
  tables[row.table_name]=data;times.add(row.exported_at);
 }
 if(times.size!==1)throw Error('Mixed export snapshots');
 for(const table of [...businessTables,'_schema'])if(!Object.hasOwn(tables,table))throw Error('Missing '+table);
 const unknown=[...new Set(tables._schema.map(c=>c.table))].filter(t=>!businessTables.includes(t)&&!['push_subscriptions','android_push_devices'].includes(t));
 if(unknown.length)throw Error('Unexported public tables need review: '+unknown.join(', '));
 return {tables,exportedAt:[...times][0],sha256:crypto.createHash('sha256').update(raw).digest('hex')};
}
const canonical=value=>JSON.stringify(value&&typeof value==='object' ? Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);
export function cents(value=0) {
 if(value===null)value=0;
 const text=String(value);
 if(!/^-?\d+(?:\.\d{1,2})?$/.test(text))throw Error('Money must have at most two decimals');
 const [whole,fraction='']=text.replace('-','').split('.');
 const result=(Number(whole)*100+Number(fraction.padEnd(2,'0')))*(text.startsWith('-')?-1:1);
 if(!Number.isSafeInteger(result))throw Error('Money outside safe integer range');
 return result;
}
const stages={New:'new',Confirmed:'confirmed','Out for delivery':'shipped',Delivered:'delivered',Canceled:'cancelled'};
const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function unique(rows,label,key=r=>r.id) {
 const ids=new Set();
 for(const row of rows){const id=key(row);if(!id||ids.has(id))throw Error('Missing/duplicate identity in '+label);ids.add(id);}
 return ids;
}

export function prepareSnapshot(source) {
 const t=source.tables;
 const workspaceIds=unique(t.workspaces,'workspaces');
 const productIds=unique(t.products,'products');
 const orderIds=unique(t.orders,'orders');
 const employeeIds=unique(t.confirmation_employees,'employees');
 const batchIds=unique(t.inventory_batches,'batches');
 unique(t.profiles,'profiles');
 unique(t.inventory_movements,'movements');
 unique(t.inventory_corrections,'corrections');
 unique(t.order_cost_allocations,'allocations');
 const productMap=new Map(t.products.map(p=>[p.id,p]));
 for(const table of businessTables)for(const row of t[table])if(row.workspace_id&&!workspaceIds.has(row.workspace_id))throw Error('Unknown workspace in '+table);
 const missingProducts=new Map();
 const variants=[];
 for(const p of t.products) {
  if(!Number.isSafeInteger(p.stock)||p.stock<0)throw Error('Invalid product stock');
  cents(p.cost);cents(p.price);
  if(p.variants?.length) {
   unique(p.variants,'product variants');
   if(p.variants.reduce((n,v)=>n+v.stock,0)!==p.stock)throw Error('Variant stock does not reconcile');
   for(const v of p.variants) {
    if(!Number.isSafeInteger(v.stock)||v.stock<0)throw Error('Invalid variant stock');
    variants.push({product_id:p.id,workspace_id:p.workspace_id,variant_id:v.id,label:v.label,stock:v.stock,variant_name:p.variant_name});
   }
  }
  if(!p.components?.length) {
   const stock=t.inventory_batches.filter(b=>b.product_id===p.id).reduce((n,b)=>n+b.remaining_quantity,0);
   if(stock!==p.stock)throw Error('FIFO stock does not reconcile');
  } else for(const part of p.components)if(!productIds.has(part.productId))throw Error('Missing bundle component');
 }
 for(const b of t.inventory_batches) {
  if(!productIds.has(b.product_id)||productMap.get(b.product_id).workspace_id!==b.workspace_id)throw Error('Invalid batch product/workspace');
  if(!Number.isSafeInteger(b.original_quantity)||!Number.isSafeInteger(b.remaining_quantity)||b.remaining_quantity<0||b.remaining_quantity>b.original_quantity)throw Error('Invalid FIFO quantities');
 }
 const lines=[],headers=[];
 for(const o of t.orders) {
  if(!stages[o.status])throw Error('Unmapped order status');
  if(!Array.isArray(o.items)||!o.items.length)throw Error('Empty order');
  if(o.confirmation_employee_id&&!employeeIds.has(o.confirmation_employee_id))throw Error('Missing employee');
  let revenue=0,cost=0,costComplete=true,quantity=0;
  o.items.forEach((item,index)=>{
   if(!Number.isSafeInteger(item.quantity)||item.quantity<=0)throw Error('Invalid order quantity');
   const product=productMap.get(item.productId);
   if(!product) {
    const known=missingProducts.get(item.productId);
    if(known&&known.workspace_id!==o.workspace_id)throw Error('Cross-workspace historical product');
    missingProducts.set(item.productId,{id:item.productId,workspace_id:o.workspace_id,archived:true,stock:0,title:'Deleted product',missing_source_metadata:true});
   } else if(product.workspace_id!==o.workspace_id)throw Error('Cross-workspace product reference');
   if(item.variantId&&product&&!product.variants?.some(v=>v.id===item.variantId)) {
    // Keep historical labels/IDs even when a variant has since been removed.
    if(!item.variantLabel)throw Error('Historical variant lacks a label');
   }
   const recordedCost=item.costTotal==null?null:cents(item.costTotal);
   if(o.status==='Delivered'&&recordedCost===null)throw Error('Delivered line lacks a historical cost snapshot');
   if(recordedCost===null)costComplete=false;else cost+=recordedCost;
   const lineRevenue=cents(item.unitPrice)*item.quantity;
   if(!Number.isSafeInteger(lineRevenue))throw Error('Unsafe line amount');
   revenue+=lineRevenue;quantity+=item.quantity;
   lines.push({order_id:o.id,line_index:index,workspace_id:o.workspace_id,product_id:item.productId,variant_id:item.variantId??null,variant_label:item.variantLabel??null,variant_name:item.variantName??null,quantity:item.quantity,unit_price_cents:cents(item.unitPrice),revenue_cents:lineRevenue,recorded_cost_cents:recordedCost});
  });
  const delivery=cents(o.delivery_charge),other=cents(o.other_expense);
  const reward=o.confirmation_employee_id?cents(o.confirmation_bonus):0;
  const effective=o.status==='Delivered'?o.delivered_at||o.created_at:o.created_at;
  if(!effective||!Number.isFinite(Date.parse(effective)))throw Error('Missing/invalid order date');
  headers.push({id:o.id,workspace_id:o.workspace_id,status:stages[o.status],source_status:o.status,created_at:o.created_at,delivered_at:o.delivered_at,effective_date:day(effective),quantity,revenue_cents:revenue,recorded_product_cost_cents:costComplete?cost:null,delivery_cost_cents:delivery,other_cost_cents:other,employee_reward_cents:reward,net_profit_cents:costComplete?revenue-cost-delivery-other-reward:null,source_payload:o});
 }
 for(const a of t.order_cost_allocations) {
  if(!orderIds.has(a.order_id)||!batchIds.has(a.batch_id))throw Error('Broken FIFO allocation reference');
  const line=lines.find(l=>l.order_id===a.order_id&&l.line_index===a.order_item_index);
  if(!line||a.workspace_id!==line.workspace_id)throw Error('Broken allocation line reference');
  const batch=t.inventory_batches.find(b=>b.id===a.batch_id);
  if(batch.workspace_id!==a.workspace_id||batch.product_id!==a.stock_product_id||a.ordered_product_id!==line.product_id)throw Error('Cross-workspace or incorrect FIFO allocation');
 }
 for(const line of lines) {
  const a=t.order_cost_allocations.filter(a=>a.order_id===line.order_id&&a.order_item_index===line.line_index);
  if(a.length&&line.recorded_cost_cents!==null&&a.reduce((n,a)=>n+cents(a.unit_cost)*a.quantity,0)!==line.recorded_cost_cents)throw Error('Cost allocations disagree with recorded line cost');
 }
 const months=new Map();
 const point=(workspace_id,month)=>{
  const key=workspace_id+':'+month;
  if(!months.has(key))months.set(key,{workspace_id,month,delivered_orders:0,revenue_cents:0,product_cost_cents:0,order_delivery_cents:0,other_cost_cents:0,employee_rewards_cents:0,shared_delivery_cents:0,net_profit_cents:0});
  return months.get(key);
 };
 for(const o of headers.filter(o=>o.status==='delivered')) {
  const m=point(o.workspace_id,o.effective_date.slice(0,7));
  m.delivered_orders++;m.revenue_cents+=o.revenue_cents;m.product_cost_cents+=o.recorded_product_cost_cents;m.order_delivery_cents+=o.delivery_cost_cents;m.other_cost_cents+=o.other_cost_cents;m.employee_rewards_cents+=o.employee_reward_cents;m.net_profit_cents+=o.net_profit_cents;
 }
 for(const e of t.daily_delivery_costs) {const m=point(e.workspace_id,e.cost_date.slice(0,7));m.shared_delivery_cents+=cents(e.amount);m.net_profit_cents-=cents(e.amount);}
 return {format:'lossless-migration-rehearsal-v1',source_sha256:source.sha256,source_project:'tsoqghvuxnoljfsbzuip',exported_at:source.exportedAt,currency:'MAD',raw_tables:t,inventory:t.products.map(p=>({...p,source_id:p.id})),historical_product_placeholders:[...missingProducts.values()],variants,orders:headers,order_lines:lines,monthly_totals:[...months.values()].sort((a,b)=>(a.workspace_id+a.month).localeCompare(b.workspace_id+b.month)),importable_into_current_live_schema:false};
}

export async function rehearse(snapshot) {
 // Deliberately has no hosted URL, credentials or network client.
 const db=new PGlite();
 try {
  await db.exec('create table raw_records(table_name text not null,row_number integer not null,payload jsonb not null,primary key(table_name,row_number));create table staged_orders(id text primary key,workspace_id text not null,payload jsonb not null);create table staged_lines(order_id text references staged_orders(id),line_index integer,payload jsonb not null,primary key(order_id,line_index));');
  const write=async()=>{
   await db.exec('begin');
   try {
    for(const [table,records] of Object.entries(snapshot.raw_tables))for(let i=0;i<records.length;i++)await db.query('insert into raw_records values($1,$2,$3) on conflict(table_name,row_number) do update set payload=excluded.payload',[table,i,records[i]]);
    for(const o of snapshot.orders)await db.query('insert into staged_orders values($1,$2,$3) on conflict(id) do update set payload=excluded.payload',[o.id,o.workspace_id,o]);
    for(const l of snapshot.order_lines)await db.query('insert into staged_lines values($1,$2,$3) on conflict(order_id,line_index) do update set payload=excluded.payload',[l.order_id,l.line_index,l]);
    await db.exec('commit');
   }catch(e){await db.exec('rollback');throw e;}
  };
  await write();await write();
  for(const [table,records] of Object.entries(snapshot.raw_tables)) {
   const loaded=(await db.query('select payload from raw_records where table_name=$1 order by row_number',[table])).rows.map(r=>r.payload);
   assert.equal(canonical(loaded),canonical(records),'Raw payload round-trip: '+table);
  }
  assert.equal(Number((await db.query('select count(*) as n from staged_orders')).rows[0].n),snapshot.orders.length);
  assert.equal(Number((await db.query('select count(*) as n from staged_lines')).rows[0].n),snapshot.order_lines.length);
  await db.exec('begin');
  const deleted=snapshot.orders[0].id;
  await db.query('delete from staged_lines where order_id=$1',[deleted]);
  await db.query('delete from staged_orders where id=$1',[deleted]);
  await db.exec('rollback');
  assert.equal(Number((await db.query('select count(*) as n from staged_orders')).rows[0].n),snapshot.orders.length);
  return {rawRoundTrip:true,repeatWithoutDuplicates:true,rollback:true,orderCount:snapshot.orders.length,lineCount:snapshot.order_lines.length};
 }finally{await db.close();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))) {
 const file=process.argv[2];
 if(!file)throw Error('Usage: node migration-tools/rehearse-import.mjs <export.csv>');
 const source=loadExport(file);const snapshot=prepareSnapshot(source);const checks=await rehearse(snapshot);
 const privateDir=path.resolve('migration-private');
 if(fs.realpathSync(process.cwd()).toLowerCase().includes('orders tracking'))throw Error('Original workspace forbidden');
 fs.mkdirSync(privateDir,{recursive:true});
 fs.writeFileSync(path.join(privateDir,'prepared-snapshot.json'),JSON.stringify(snapshot,null,2));
 fs.writeFileSync(path.join(privateDir,'rehearsal-summary.json'),JSON.stringify({checks,sha256:source.sha256,monthlyTotals:snapshot.monthly_totals,counts:{products:snapshot.inventory.length,placeholders:snapshot.historical_product_placeholders.length,variants:snapshot.variants.length,orders:snapshot.orders.length,lines:snapshot.order_lines.length},cloudWrites:0,readyForLiveImport:false},null,2));
 console.log(JSON.stringify({checks,counts:{products:snapshot.inventory.length,historicalPlaceholders:snapshot.historical_product_placeholders.length,variants:snapshot.variants.length,orders:snapshot.orders.length,lines:snapshot.order_lines.length},monthlyTotals:snapshot.monthly_totals,cloudWrites:0,readyForLiveImport:false},null,2));
}
