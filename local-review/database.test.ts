import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
);
await db.exec(
  fs.readFileSync(
    "supabase/migrations/20261031093505_rebuild_supabase_foundation.sql",
    "utf8",
  ),
);
await db.exec(fs.readFileSync('supabase/migrations/20261031093623_rebuild_advisor_hardening.sql', 'utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261031101505_order_delivery_date_correction.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261031102131_refresh_pending_order_prices.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261031224203_lossless_order_compatibility.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261031230351_bundle_cost_estimates.sql','utf8'));
const ids = {
  admin: "11111111-1111-4111-8111-111111111111",
  viewer: "22222222-2222-4222-8222-222222222222",
  stranger: "33333333-3333-4333-8333-333333333333",
  w: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  other: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  p: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  order: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  member: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  pay: "ffffffff-ffff-4fff-8fff-ffffffffffff",
};
await db.exec(
  `insert into auth.users(id,email) values ('${ids.admin}','admin@local.test'),('${ids.viewer}','viewer@local.test'),('${ids.stranger}','stranger@local.test');insert into public.workspaces(id,name) values('${ids.w}','Test workspace'),('${ids.other}','Other workspace');insert into public.workspace_members(workspace_id,user_id,role) values('${ids.w}','${ids.admin}','admin'),('${ids.w}','${ids.viewer}','viewer');`,
);
const sql = async (q: string, params: any[] = []) => db.query<any>(q, params);
const as = async (id: string) => {
  await db.exec("reset role");
  await sql("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
};
const rpc = async (name: string, args: any[]) => {
  const ps = args.map((_, i) => "$" + (i + 1)).join(",");
  return sql("select public." + name + "(" + ps + ") result", args);
};
const fails = async (run: () => Promise<unknown>, pattern: RegExp) => {
  await assert.rejects(run, pattern);
};
let count = 0;
const passed = (name: string) => {
  count++;
  console.log("PASS", name);
};
await as(ids.stranger);
assert.equal((await sql("select * from public.orders")).rows.length, 0);
await fails(
  () => rpc("save_inventory", [ids.w, ids.p, { title: "bad", stock: 1 }]),
  /Approved workspace/,
);
passed("Unapproved account cannot access business records or create products");
await as(ids.admin);
await rpc("save_inventory", [
  ids.w,
  ids.p,
  { title: "Lamp", cost_price: 10, selling_price: 100, stock: 1 },
]);
await rpc("restock_inventory", [
  ids.w,
  ids.p,
  { quantity: 1, cost_price: 20, selling_price: 100 },
]);
await sql(
  "insert into public.team_members(id,workspace_id,name,base_reward) values($1,$2,$3,$4)",
  [ids.member, ids.w, "Test employee", 5],
);
const input = {
  item_id: ids.p,
  item_title: "Lamp",
  quantity: 2,
  sale_price: 110,
  status: "confirmed",
  confirmation_member_id: ids.member,
};
await rpc("save_order", [ids.w, ids.order, input]);
let item = (
  await sql("select stock from public.inventory where id=$1", [ids.p])
).rows[0];
assert.equal(item.stock, 2);
assert.equal(
  (await sql("select member_reward from public.orders")).rows[0].member_reward,
  "0.00",
);
passed("Pending order does not consume stock or earn Delivered bonus");
await rpc("save_order", [
  ids.w,
  ids.order,
  {
    ...input,
    status: "delivered",
    unit_cost: 0,
    net_profit: 99999,
    member_reward: 99999,
  },
]);
let order = (await sql("select * from public.orders")).rows[0];
assert.equal(Number(order.unit_cost), 15);
assert.equal(Number(order.member_reward), 25);
assert.equal(Number(order.net_profit), 165);
assert.equal(
  (await sql("select stock from public.inventory")).rows[0].stock,
  0,
);
passed(
  "Delivery atomically consumes mixed FIFO batches, uses real costs, pays per-unit upsell and ignores forged totals",
);
await rpc("save_order", [
  ids.w,
  ids.order,
  { ...input, status: "delivered", notes: "Retry" },
]);
assert.equal(
  (await sql("select stock from public.inventory")).rows[0].stock,
  0,
);
passed("Retry and note-only edit do not deduct stock again");
await fails(
  () =>
    rpc("save_order", [
      ids.w,
      "99999999-9999-4999-8999-999999999999",
      { ...input, quantity: 1, status: "delivered" },
    ]),
  /Not enough stock/,
);
assert.equal((await sql("select count(*) n from public.orders")).rows[0].n, 1);
passed("Insufficient stock rejects and rolls back the whole order");
await rpc("record_payout", [
  ids.w,
  ids.pay,
  { member_id: ids.member, amount: 25 },
]);
await rpc("record_payout", [
  ids.w,
  ids.pay,
  { member_id: ids.member, amount: 25 },
]);
assert.equal(
  Number(
    (await sql("select total_paid from public.team_members")).rows[0]
      .total_paid,
  ),
  25,
);
await fails(
  () =>
    rpc("record_payout", [
      ids.w,
      "88888888-8888-4888-8888-888888888888",
      { member_id: ids.member, amount: 1 },
    ]),
  /exceeds/,
);
passed("Payout is retry-safe and cannot exceed earned unpaid rewards");
await rpc("delete_payout", [ids.w, ids.pay]);
assert.equal(
  Number(
    (await sql("select total_paid from public.team_members")).rows[0]
      .total_paid,
  ),
  0,
);
passed("Deleting payout reconciles employee balance");
await rpc("save_order", [ids.w, ids.order, { ...input, status: "cancelled" }]);
item = (await sql("select * from public.inventory")).rows[0];
assert.equal(item.stock, 2);
assert.equal(item.batches[0].remainingQty, 1);
assert.equal(item.batches[1].remainingQty, 1);
passed("Cancel restores exact original FIFO lots");
await as(ids.viewer);
await fails(
  () => rpc("save_order", [ids.w, ids.order, input]),
  /Approved workspace/,
);
await fails(
  () => sql("update public.inventory set stock=999"),
  /permission denied/,
);
await fails(
  () => sql("update public.workspace_members set role='admin'"),
  /permission denied/,
);
passed("Viewer cannot mutate orders, forge stock or promote their role");
await as(ids.admin);
await fails(
  () => rpc("save_order", [ids.other, ids.order, input]),
  /Approved workspace/,
);
await fails(
  () => rpc("set_member_role", [ids.w, ids.admin, "viewer"]),
  /at least one/,
);
passed("Workspace boundary and last-admin protection hold");
await as(ids.viewer);
const redacted = (
  await rpc("read_workspace_records", [ids.w, "inventory", 0, 500, null])
).rows[0].result;
assert.equal(redacted.rows[0].cost_price, 0);
assert.deepEqual(redacted.rows[0].batches, []);
assert.equal((await sql("select * from public.inventory")).rows.length, 0);
passed(
  "Operational readers get redacted data and cannot read raw financial tables",
);
await as(ids.admin);
const bundle = "77777777-7777-4777-8777-777777777777";
await rpc("save_inventory", [
  ids.w,
  bundle,
  {
    title: "Pair of lamps",
    is_bundle: true,
    selling_price: 200,
    bundle_items: [{ itemId: ids.p, quantity: 2 }],
  },
]);
await rpc("save_order", [
  ids.w,
  "66666666-6666-4666-8666-666666666666",
  {
    item_id: bundle,
    item_title: "Pair",
    quantity: 1,
    sale_price: 220,
    status: "delivered",
  },
]);
assert.equal(
  (await sql("select stock from public.inventory where id=$1", [ids.p])).rows[0]
    .stock,
  0,
);
assert.equal(
  (await sql("select stock from public.inventory where id=$1", [bundle]))
    .rows[0].stock,
  0,
);
await rpc("delete_order", [ids.w, "66666666-6666-4666-8666-666666666666"]);
assert.equal(
  (await sql("select stock from public.inventory where id=$1", [ids.p])).rows[0]
    .stock,
  2,
);
passed("Bundle consumes component FIFO lots and deletion reverses them");

// Delivery-date corrections must move profit attribution without moving stock again.
await as(ids.admin);
const datedOrder = "88888888-8888-4888-8888-888888888888";
const datedInput = {item_title:"Date correction", quantity:1, sale_price:100, unit_cost:40, shipping_cost:12, shipping_charged:3, status:"delivered", delivered_date:"2026-10-30"};
await rpc("save_order", [ids.w, datedOrder, datedInput]);
await rpc("save_order", [ids.w, datedOrder, {...datedInput, delivered_date:"2026-10-29"}]);
const corrected = (await sql("select delivered_date::text,shipping_cost,shipping_charged,net_profit from public.orders where id=$1",[datedOrder])).rows[0];
assert.equal(corrected.delivered_date,"2026-10-29");
assert.equal(Number(corrected.shipping_cost),12);
assert.equal(Number(corrected.net_profit),51);
passed("Delivery date can be corrected without dropping saved shipping amounts");


const preorderProduct = "99999999-9999-4999-8999-999999999999";
const preorderId = "99999999-9999-4999-8999-999999999998";
await rpc("save_inventory",[ids.w,preorderProduct,{title:"Preorder lamp",stock:0,cost_price:20,selling_price:100}]);
await rpc("save_order",[ids.w,preorderId,{item_id:preorderProduct,item_title:"Preorder lamp",quantity:1,sale_price:110,status:"confirmed",confirmation_member_id:ids.member,notes:"Keep my agreed price and notes"}]);
await rpc("restock_inventory",[ids.w,preorderProduct,{quantity:2,cost_price:35,selling_price:105}]);
let preorder=(await sql("select * from public.orders where id=$1",[preorderId])).rows[0];
assert.equal(Number(preorder.unit_cost),35);
assert.equal(Number(preorder.base_price),105);
assert.equal(Number(preorder.sale_price),110);
assert.equal(Number(preorder.net_profit),75);
assert.equal(preorder.notes,"Keep my agreed price and notes");
assert.equal(preorder.status,"confirmed");
assert.equal((await sql("select stock from public.inventory where id=$1",[preorderProduct])).rows[0].stock,2);
passed("Restock reprices waiting orders immediately without changing agreed price, notes, status or stock");
await rpc("save_order",[ids.w,preorderId,{...preorder,status:"delivered"}]);
const historical=(await sql("select * from public.orders where id=$1",[preorderId])).rows[0];
await rpc("save_inventory",[ids.w,preorderProduct,{cost_price:60,selling_price:150}]);
assert.deepEqual((await sql("select * from public.orders where id=$1",[preorderId])).rows[0],historical);
passed("Catalog repricing preserves delivered-order costs and earned bonuses");


// Identical prices leave the waiting-order record semantically unchanged.
await rpc("save_inventory",[ids.w,preorderProduct,{cost_price:35,selling_price:105}]);
await rpc("save_order",[ids.w,preorderId,{...preorder,status:"confirmed"}]);
const beforeSame=(await sql("select * from public.orders where id=$1",[preorderId])).rows[0];
await rpc("restock_inventory",[ids.w,preorderProduct,{quantity:1,cost_price:35,selling_price:105}]);
assert.deepEqual((await sql("select * from public.orders where id=$1",[preorderId])).rows[0],beforeSame);
passed("Same-price restock leaves the waiting order unchanged");


await as(ids.admin);
const vp="12121212-1212-4212-8212-121212121212", black="13131313-1313-4313-8313-131313131313", white="14141414-1414-4414-8414-141414141414", vo="15151515-1515-4515-8515-151515151515";
await rpc("save_inventory",[ids.w,vp,{title:"Variant lamp",cost_price:10,selling_price:20,variants:[{id:black,label:"Black",stock:1},{id:white,label:"White",stock:2}]}]);
assert.equal((await sql("select stock from public.inventory where id=$1",[vp])).rows[0].stock,3);
const multi={items:[{itemId:vp,variantId:black,quantity:1,salePrice:25},{itemId:vp,variantId:white,quantity:1,salePrice:25}],status:"confirmed",confirmation_member_id:ids.member};
await rpc("save_order",[ids.w,vo,multi]);
assert.equal((await sql("select stock from public.inventory where id=$1",[vp])).rows[0].stock,3);
await rpc("save_order",[ids.w,vo,{...multi,status:"delivered"}]);
let vr=(await sql("select * from public.orders where id=$1",[vo])).rows[0];
assert.equal(vr.items.length,2);assert.equal(Number(vr.total_revenue),50);assert.equal(Number(vr.member_reward),15);assert.equal(Number(vr.net_profit),15);
assert.deepEqual((await sql("select variants from public.inventory where id=$1",[vp])).rows[0].variants.map((v:any)=>v.stock),[0,1]);
await rpc("save_order",[ids.w,vo,{...vr,notes:"No second deduction"}]);
assert.equal((await sql("select stock from public.inventory where id=$1",[vp])).rows[0].stock,1);
passed("Two variants share one order, correct reward, one FIFO deduction and safe retry");
await fails(()=>rpc("save_order",[ids.w,"16161616-1616-4616-8616-161616161616",{items:[{itemId:vp,variantId:black,quantity:1,salePrice:25}],status:"delivered"}]),/Not enough stock/);
assert.equal((await sql("select stock from public.inventory where id=$1",[vp])).rows[0].stock,1);
await rpc("save_order",[ids.w,vo,{...vr,status:"cancelled"}]);
assert.deepEqual((await sql("select variants from public.inventory where id=$1",[vp])).rows[0].variants.map((v:any)=>v.stock),[1,2]);
passed("Variant shortage rolls back atomically and cancellation restores exact variant quantities");
await rpc("restock_inventory",[ids.w,vp,{quantity:2,cost_price:15,selling_price:22,variant_id:black}]);
assert.deepEqual((await sql("select variants from public.inventory where id=$1",[vp])).rows[0].variants.map((v:any)=>v.stock),[3,2]);
await fails(()=>rpc("restock_inventory",[ids.w,vp,{quantity:1,cost_price:15,selling_price:22}]),/Choose a variant/);
passed("Restock is variant-specific and requires a valid selection");
await rpc("save_daily_delivery_cost",[ids.w,"2026-10-31",7]);
assert.equal((await rpc("read_workspace_records",[ids.w,"daily_delivery_costs",0,500,null])).rows[0].result.rows[0].amount,7);
await as(ids.viewer);
assert.equal((await rpc("read_workspace_records",[ids.w,"daily_delivery_costs",0,500,null])).rows[0].result.rows.length,0);
const protectedItems=(await rpc("read_workspace_records",[ids.w,"orders",0,500,vo])).rows[0].result.rows[0].items;
assert.ok(protectedItems.every((l:any)=>l.unitCost===0&&l.basePrice===0&&l.costTotal===0));
await fails(()=>rpc("save_daily_delivery_cost",[ids.w,"2026-10-31",100]),/Approved workspace/);
passed("Daily costs and nested line costs retain role protection");
await as(ids.admin);

const functions = (
  await sql(
    "select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and has_function_privilege('anon',p.oid,'execute')",
  )
).rows;
assert.equal(functions.length, 0);
passed("Anonymous role has no application RPC execution");
await fails(
  () =>
    db.exec(
      fs.readFileSync(
        "supabase/migrations/20261031093505_rebuild_supabase_foundation.sql",
        "utf8",
      ),
    ),
  /separate empty/,
);
passed("Migration refuses an existing app database before any DDL");
console.log("Database regression checks passed:", count);
await db.close();
