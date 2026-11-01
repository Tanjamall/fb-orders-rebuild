import fs from 'node:fs';
import Papa from 'papaparse';
const expected=["workspaces","profiles","workspace_members","products","orders","confirmation_employees","inventory_batches","order_cost_allocations","inventory_movements","inventory_corrections","daily_delivery_costs"];
const input=process.argv[2];
if(!input) { console.error('Usage: node migration-tools/inspect-original-export.mjs <downloaded.csv-or-json>');process.exit(2); }
const raw=fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'');
let rows;
if(raw.trim().startsWith('[')) rows=JSON.parse(raw);
else {
 const parsed=Papa.parse(raw,{header:true,skipEmptyLines:true});
 if(parsed.errors.length) throw Error('CSV could not be parsed completely: '+parsed.errors.map(e=>e.message).join('; '));
 rows=parsed.data;
}
if(!Array.isArray(rows))throw Error('Expected exported result rows.');
const data={}; const timestamps=new Set();
for(const row of rows) {
 if(row.format!=='tanger-business-export-v1'||row.source_project!=='tsoqghvuxnoljfsbzuip')throw Error('Unexpected export format/source.');
 if(data[row.table_name])throw Error('Duplicate exported table: '+row.table_name);
 const records=typeof row.data==='string'?JSON.parse(row.data):row.data;
 if(!Array.isArray(records)||!Number.isSafeInteger(Number(row.row_count))||Number(row.row_count)!==records.length)throw Error('Incomplete/truncated table: '+row.table_name);
 data[row.table_name]=records; timestamps.add(row.exported_at);
}
for(const name of [...expected,'_schema'])if(!data[name])throw Error('Missing table: '+name);
if(timestamps.size!==1)throw Error('Tables were not exported together.');
const unexpected=[...new Set(data._schema.map(c=>c.table))].filter(t=>!expected.includes(t)&&!['push_subscriptions','android_push_devices'].includes(t));
const orders=data.orders;
const statusCounts={};for(const o of orders)statusCounts[o.status]=(statusCounts[o.status]||0)+1;
const byWorkspace={};for(const o of orders)byWorkspace[o.workspace_id]=(byWorkspace[o.workspace_id]||0)+1;
const result={
 format:'original-compatibility-audit-v1',exportedAt:[...timestamps][0],
 counts:Object.fromEntries(expected.map(t=>[t,data[t].length])),
 orderStatusCounts:statusCounts,ordersPerWorkspace:byWorkspace,
 archivedProducts:data.products.filter(p=>p.archived).length,
 productsWithVariants:data.products.filter(p=>Array.isArray(p.variants)&&p.variants.length>0).length,
 multiLineOrders:orders.filter(o=>Array.isArray(o.items)&&o.items.length>1).length,
 variantOrderLines:orders.reduce((n,o)=>n+(o.items||[]).filter(i=>i.variantId||i.variantLabel).length,0),
 unexpectedPublicTables:unexpected,
 readiness:'AUDIT_ONLY_NO_IMPORT',
 requiredCompatibilityWork:['Lossless multi-line order and variant support','Shared daily delivery costs and settings','Historical cost allocations, inventory corrections and movements','Employee earning stages and historical bonus snapshots','Explicit identity/workspace mapping; retain separate credentials','Currency labels: preserve DH amounts without conversion'],
};
console.log(JSON.stringify(result,null,2));
