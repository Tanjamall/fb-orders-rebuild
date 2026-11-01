import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backendConfig,
  toDatabase,
  fromDatabase,
} from "../src/services/backendConfig";
import { calculateMemberReward } from "../src/types";
import {
  saveInventoryItem,
  saveOrder,
  readOrder,
  subscribeToInventory,
  pagedRows,
  restockInventoryItem,
} from "../src/services/db";
import { demoRead, demoReset } from "../src/services/demoStore";
test("original project is blocked and missing development configuration cannot fall through to a live client", () => {
  assert.equal(backendConfig({}).isDemo, true);
  assert.throws(
    () =>
      backendConfig({
        VITE_SUPABASE_URL: "https://tsoqghvuxnoljfsbzuip.supabase.co",
      }),
    /Golden rule/,
  );
  assert.throws(
    () => backendConfig({ VITE_DATA_MODE: "supabase" }),
    /Configure/,
  );
  assert.throws(
    () => backendConfig({ VITE_SUPABASE_ANON_KEY: "sb_secret_test" }),
    /secret/,
  );
  const jwt = "a." + btoa(JSON.stringify({ role: "service_role" })) + ".b";
  assert.throws(() => backendConfig({ VITE_SUPABASE_ANON_KEY: jwt }), /anon/);
  assert.equal(
    backendConfig({
      VITE_DATA_MODE: "supabase",
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_test",
    }).isDemo,
    false,
  );
});
test("database mapping omits UI IDs, undefined values, ownership and protected balances", () => {
  const row = toDatabase({
    id: "do-not-send",
    workspaceId: "bad",
    createdBy: "forged",
    totalPaid: 999,
    customerPhone: undefined,
    itemTitle: "Lamp",
    salePrice: 110,
  });
  assert.deepEqual(row, { item_title: "Lamp", sale_price: 110 });
  assert.deepEqual(
    fromDatabase({
      id: "p1",
      workspace_id: "w1",
      sale_price: 110,
      customer_phone: null,
    }),
    { id: "p1", salePrice: 110, customerPhone: undefined },
  );
});
test("per-order reward still pays upsell on every unit", () => {
  assert.equal(
    calculateMemberReward(5, 100, 110, 2, "per_order").totalReward,
    25,
  );
  assert.equal(calculateMemberReward(5, 0, 10, 2, "per_order").totalReward, 25);
});
test("paginated RPC reads handle capped pages and reject changing history", async () => {
  let calls = 0;
  const client = {
    rpc: async () => ({
      data: {
        rows: ++calls === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
        total: 3,
      },
      error: null,
    }),
  };
  assert.equal((await pagedRows(client, "orders", "w1")).length, 3);
  calls = 0;
  await assert.rejects(
    () =>
      pagedRows(
        {
          rpc: async () => ({
            data: { rows: [{ id: ++calls }], total: calls === 1 ? 3 : 4 },
          }),
        },
        "orders",
        "w1",
      ),
    /changed/,
  );
});
test("demo CRUD subscriptions and delivery use atomic persistent store transitions", async () => {
  demoReset();
  let notifications = 0;
  const close = subscribeToInventory(() => notifications++);
  const id = await saveInventoryItem({
    title: "Local regression lamp",
    category: "Test",
    condition: "new",
    costPrice: 40,
    sellingPrice: 100,
    stock: 1,
    lowStockThreshold: 1,
    status: "active",
    fulfillmentType: "local",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const input: any = {
    itemId: id,
    itemTitle: "Lamp",
    quantity: 1,
    unitCost: 0,
    salePrice: 110,
    shippingCharged: 0,
    shippingCost: 0,
    platformFee: 0,
    buyerName: "Local only",
    paymentMethod: "cash",
    fulfillmentType: "local_pickup",
    status: "confirmed",
    date: "2026-10-30",
    createdAt: new Date().toISOString(),
  };
  const oid = await saveOrder(input);
  assert.equal(demoRead("inventory").find((p) => p.id === id).stock, 1);
  await saveOrder({ ...input, status: "delivered" }, oid);
  assert.equal(demoRead("inventory").find((p) => p.id === id).stock, 0);
  assert.equal((await readOrder(oid)).unitCost, 40);
  await assert.rejects(
    () => saveOrder({ ...input, status: "delivered" }),
    /stock/,
  );
  assert.equal(demoRead("inventory").find((p) => p.id === id).stock, 0);
  await saveOrder({ ...input, status: "confirmed" }, oid);
  assert.equal(demoRead("inventory").find((p) => p.id === id).stock, 1);
  assert.ok(notifications >= 4);
  close();
  demoReset();
});

test("undelivered and shipped orders are excluded from realized analytics", async () => {
  const { calculatePeriodStats } = await import(
    "../src/services/analyticsComparison"
  );
  for (const status of ["new", "confirmed", "shipped", "cancelled"])
    assert.equal(
      calculatePeriodStats([
        { status, totalRevenue: 100, netProfit: 60 } as any,
      ]).revenue,
      0,
    );
});

test("demo preorder prices follow a restock and delivery dates remain editable", async () => {
  demoReset();
  const id = await saveInventoryItem({
    title:"Preorder regression",category:"Test",condition:"new",costPrice:20,sellingPrice:100,
    stock:0,lowStockThreshold:1,status:"out_of_stock",fulfillmentType:"local",
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  });
  const orderId=await saveOrder({itemId:id,itemTitle:"Preorder regression",quantity:1,unitCost:20,salePrice:110,
    buyerName:"Test",paymentMethod:"cash",fulfillmentType:"local_pickup",status:"confirmed",date:"2026-10-30"} as any);
  const product=demoRead("inventory").find(p=>p.id===id);
  await restockInventoryItem(id,product,{quantity:2,costPrice:35,sellingPrice:105});
  const pending=await readOrder(orderId);
  assert.equal(pending.unitCost,35);
  assert.equal(pending.basePrice,105);
  assert.equal(pending.salePrice,110);
  assert.equal(pending.netProfit,75);
  assert.equal(demoRead("inventory").find(p=>p.id===id).stock,2);
  await saveOrder({...pending,status:"delivered",deliveredDate:"2026-10-30"},orderId);
  const delivered=await readOrder(orderId);
  await saveOrder({...delivered,deliveredDate:"2026-10-29"},orderId);
  assert.equal((await readOrder(orderId)).deliveredDate,"2026-10-29");
  demoReset();
});

test('multi variant demo delivery is atomic, repeat-safe and reversible', async()=>{
 demoReset();
 const id=await saveInventoryItem({title:'Variant QA',category:'Test',condition:'new',costPrice:40,sellingPrice:100,stock:2,variants:[{id:'black',label:'Black',stock:1},{id:'red',label:'Red',stock:1}],lowStockThreshold:1,status:'active',fulfillmentType:'local',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 const input:any={itemId:id,itemTitle:'Variant QA',quantity:2,salePrice:110,unitCost:40,buyerName:'QA',paymentMethod:'cash',fulfillmentType:'local_pickup',status:'confirmed',date:'2026-10-31',items:['black','red'].map(variantId=>({itemId:id,itemTitle:'Variant QA',quantity:1,salePrice:110,unitCost:40,variantId}))};
 const oid=await saveOrder(input);await saveOrder({...input,status:'delivered'},oid);
 assert.equal((await readOrder(oid)).totalCost,80);
 assert.deepEqual(demoRead('inventory').find(p=>p.id===id).variants.map((v:any)=>v.stock),[0,0]);
 await saveOrder({...await readOrder(oid),notes:'retry'},oid);assert.equal(demoRead('inventory').find(p=>p.id===id).stock,0);
 await assert.rejects(()=>saveOrder({...input,status:'delivered'}),/stock/);
 await saveOrder({...await readOrder(oid),status:'cancelled'},oid);
 assert.deepEqual(demoRead('inventory').find(p=>p.id===id).variants.map((v:any)=>v.stock),[1,1]);
 demoReset();
});

test('workspace reads retry transient transport failures but never permission denials',async()=>{
 let attempts=0;const flaky={rpc:async()=>++attempts<2?{error:Error('TypeError: Failed to fetch')}:{data:{rows:[],total:0},error:null}};
 assert.deepEqual(await pagedRows(flaky,'orders','test'),[]);assert.equal(attempts,2);
 attempts=0;await assert.rejects(()=>pagedRows({rpc:async()=>{attempts++;return {error:Error('Permission denied')};}},'orders','test'),/Permission/);assert.equal(attempts,1);
});
