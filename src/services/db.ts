import { isDemo, requireWorkspace } from "../supabase";
import type {
  InventoryItem,
  DailyDeliveryCost,
  Order,
  Vendor,
  UserProfile,
  ConfirmationMember,
  TeamPayout,
} from "../types";
import { calculateMemberReward } from "../types";
import { fromDatabase, toDatabase, businessToday } from "./backendConfig";
import {
  demoRead,
  demoUpdate,
  demoListen,
  demoReset,
  type DemoTable,
} from "./demoStore";
import { appendRestockLot, deductFifoStock } from "./fifo";
import {quoteLines} from './orderLines';
const refreshEvent = "fb-orders-rebuild-refresh";
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const delivered = (status: string) =>
  ["delivered", "completed"].includes(status);
const changed = () => {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(refreshEvent));
};
export async function pagedRows(
  client: any,
  table: string,
  workspaceId: string,
) {
  const rows: any[] = [];
  let expected: number | undefined;
  for (let offset = 0; ; ) {
    let response:any;
    for(let attempt=0;attempt<3;attempt++){
      try{response=await client.rpc("read_workspace_records",{target_workspace:workspaceId,table_name:table,page_offset:offset,page_size:500});}
      catch(error){response={error};}
      if(!response.error||attempt===2||!/failed to fetch|networkerror|network request failed|load failed/i.test(response.error.message||''))break;
      await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)));
    }
    const {data,error}=response;
    if (error) throw error;
    if (
      !data ||
      !Array.isArray(data.rows) ||
      !Number.isSafeInteger(data.total) ||
      data.total < 0
    )
      throw Error("Invalid workspace history response.");
    const page = data.rows;
    if (expected !== undefined && expected !== data.total)
      throw Error("Records changed while loading. Please refresh.");
    expected = data.total;
    if (!page.length && rows.length < expected!)
      throw Error("Incomplete workspace history.");
    rows.push(...page);
    if (rows.length > expected!)
      throw Error("Workspace history count does not reconcile.");
    offset += page.length;
    if (rows.length === expected) break;
  }
  return rows;
}

function subscribe<T>(
  table: DemoTable,
  onData: (data: T[]) => void,
  onError?: (err: Error) => void,
) {
  if (isDemo) {
    const read = () => onData(demoRead(table));
    read();
    return demoListen(read);
  }
  let alive = true,
    running = false,
    pending = false;
  const { client, workspaceId } = requireWorkspace();
  const load = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      do {
        pending = false;
        const rows = await pagedRows(client, table, workspaceId);
        if (alive) {
          const mapped = rows.map((row) => fromDatabase<T>(row));
          mapped.sort((a: any, b: any) =>
            String(b.date || b.updatedAt || b.createdAt || "").localeCompare(
              String(a.date || a.updatedAt || a.createdAt || ""),
            ),
          );
          onData(mapped);
        }
      } while (pending && alive);
    } catch (e) {
      if (alive) onError?.(e as Error);
    } finally {
      running = false;
    }
  };
  const channel = client
    .channel(table + "-" + uuid())
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: "workspace_id=eq." + workspaceId,
      },
      () => void load(),
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void load();
      if (status === "CHANNEL_ERROR")
        onError?.(
          new Error(
            "Live updates disconnected. Retrying with periodic refresh.",
          ),
        );
    });
  void load();
  const listener = () => void load();
  window.addEventListener(refreshEvent, listener);
  window.addEventListener("focus", listener);
  window.addEventListener("online", listener);
  const timer = setInterval(listener, 30000);
  return () => {
    alive = false;
    clearInterval(timer);
    window.removeEventListener(refreshEvent, listener);
    window.removeEventListener("focus", listener);
    window.removeEventListener("online", listener);
    void client.removeChannel(channel);
  };
}
async function rpc(name: string, args: Record<string, unknown>) {
  const { client, workspaceId } = requireWorkspace();
  const { data, error } = await client.rpc(name, {
    target_workspace: workspaceId,
    ...args,
  });
  if (error) throw Error(error.message);
  changed();
  return data;
}
async function upsert<T extends { id: string }>(
  table: DemoTable,
  value: Omit<T, "id">,
  id?: string,
): Promise<string> {
  const record = { ...value, id: id || uuid(), updatedAt: now() };
  if (isDemo) {
    demoUpdate((state) => {
      const list = state[table] as any[];
      const i = list.findIndex((r) => r.id === record.id);
      const previous = i >= 0 ? list[i] : null;
      if (i >= 0) list[i] = { ...list[i], ...record };
      else list.unshift({ ...record, createdAt: now() });
      if (table === 'inventory' && previous && (previous.costPrice !== (record as any).costPrice || previous.sellingPrice !== (record as any).sellingPrice)) {
        state.orders = state.orders.map((order) => (order.itemId === record.id || order.items?.some(l=>l.itemId===record.id)) && ['new','confirmed','pending_pickup','shipped'].includes(order.status) ? demoOrder(order, order.id, state) : order);
      }
    });
    return record.id;
  }
  const { client, workspaceId } = requireWorkspace();
  const payload = toDatabase(value as any);
  const query = id
    ? client
        .from(table)
        .update(payload)
        .eq("id", id)
        .eq("workspace_id", workspaceId)
    : client
        .from(table)
        .insert({ ...payload, id: record.id, workspace_id: workspaceId });
  const { error } = await query.select("id").single();
  if (error) throw Error(error.message);
  changed();
  return record.id;
}
async function remove(table: DemoTable, id: string) {
  if (isDemo) {
    demoUpdate((state) => {
      (state[table] as any) = state[table].filter((r) => r.id !== id);
    });
    return;
  }
  const { client, workspaceId } = requireWorkspace();
  const { error } = await client
    .from(table)
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw Error(error.message);
  changed();
}
export const subscribeToInventory = (
  cb: (items: InventoryItem[]) => void,
  err?: (e: Error) => void,
) => subscribe("inventory", cb, err);
export const subscribeToOrders = (
  cb: (items: Order[]) => void,
  err?: (e: Error) => void,
) => subscribe("orders", cb, err);
export const subscribeToVendors = (
  cb: (items: Vendor[]) => void,
  err?: (e: Error) => void,
) => subscribe("vendors", cb, err);
export const subscribeToTeamMembers = (
  cb: (items: ConfirmationMember[]) => void,
  err?: (e: Error) => void,
) => subscribe("team_members", cb, err);
export const subscribeToTeamPayouts = (
  cb: (items: TeamPayout[]) => void,
  err?: (e: Error) => void,
) => subscribe("team_payouts", cb, err);
export function subscribeToTeam(
  cb: (items: UserProfile[]) => void,
  err?: (e: Error) => void,
) {
  if (isDemo) {
    cb([]);
    return () => {};
  }
  let active = true;
  const { client, workspaceId } = requireWorkspace();
  void client
    .rpc("list_workspace_members", { target_workspace: workspaceId })
    .then(({ data, error }) => {
      if (active) {
        if (error) err?.(Error(error.message));
        else cb(data || []);
      }
    });
  return () => {
    active = false;
  };
}
export async function saveInventoryItem(
  item: Omit<InventoryItem, "id">,
  id?: string,
) {
  if (isDemo) return upsert<InventoryItem>("inventory", item, id);
  return rpc("save_inventory", {
    product: toDatabase(item as any),
    product_id: id || uuid(),
  });
}
export async function adjustInventoryStock(
  itemId: string,
  _currentStock: number,
  delta: number,
) {
  if (isDemo) {
    const item = demoRead("inventory").find((i) => i.id === itemId);
    if (!item) throw Error("Product not found");
    if (delta < 0) {
      const r = deductFifoStock(item, -delta);
      await saveInventoryItem(
        {
          ...item,
          batches: r.updatedBatches,
          stock: r.newStock,
          costPrice: r.newCostPrice,
          sellingPrice: r.newSellingPrice,
        },
        itemId,
      );
    } else
      await restockInventoryItem(itemId, item, {
        quantity: delta,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
      });
    return;
  }
  await rpc("adjust_stock", { product_id: itemId, delta });
}
export async function restockInventoryItem(
  itemId: string,
  item: InventoryItem,
  lot: {
    quantity: number;
    costPrice: number;
    sellingPrice: number;
    supplier?: string;
    notes?: string;
    receivedDate?: string;
    variantId?: string;
  },
): Promise<InventoryItem> {
  if (isDemo) {
    if (!Number.isInteger(lot.quantity) || lot.quantity <= 0)
      throw Error("Enter a positive whole quantity.");
    if(item.variants?.length&&!item.variants.some(v=>v.id===lot.variantId))throw Error('Choose a variant');
    const r = appendRestockLot(item, lot);
    const updated = {
      ...item,
      variants:item.variants?.map(v=>v.id===lot.variantId?{...v,stock:v.stock+lot.quantity}:v),
      batches: r.updatedBatches,
      stock: r.newStock,
      costPrice: r.newCostPrice,
      sellingPrice: r.newSellingPrice,
      status:
        item.status === "archived"
          ? item.status
          : r.newStock > 0
            ? ("active" as const)
            : item.status,
      updatedAt: now(),
    };
    await upsert<InventoryItem>("inventory", updated, itemId);
    return updated;
  }
  return fromDatabase<InventoryItem>(
    await rpc("restock_inventory", {
      product_id: itemId,
      lot: toDatabase(lot as any),
    }),
  );
}
export async function toggleArchiveInventoryItem(item: InventoryItem) {
  const status =
    item.status === "archived"
      ? item.stock > 0
        ? "active"
        : "out_of_stock"
      : "archived";
  if (isDemo) {
    await upsert<InventoryItem>("inventory", { ...item, status }, item.id);
    return;
  }
  await rpc("archive_inventory", {
    product_id: item.id,
    archive: status === "archived",
  });
}
export const deleteInventoryItem = (id: string) =>
  isDemo
    ? remove("inventory", id)
    : rpc("delete_inventory", { product_id: id }).then(() => {});
export type OrderInput = Omit<
  Order,
  "id" | "totalRevenue" | "totalCost" | "netProfit" | "profitMargin"
> &
  Partial<
    Pick<Order, "totalRevenue" | "totalCost" | "netProfit" | "profitMargin">
  >;
function demoOrderLegacy(input: OrderInput, id: string, data: any): Order {
  const previous: Order | undefined = data.orders.find(
    (o: Order) => o.id === id,
  );
  // Return old allocations before applying the new delivered state. Demo update is atomic.
  const allocations: any[] = [];
  const allocate = (itemId: string, qty: number): number => {
    const product = data.inventory.find((p: InventoryItem) => p.id === itemId);
    if (!product) throw Error("Product not found");
    if (product.isBundle) {
      let sum = 0;
      for (const part of product.bundleItems || [])
        sum += allocate(part.itemId, qty * part.quantity);
      return sum;
    }
    const batches = product.batches?.length
      ? product.batches
      : [
          {
            id: "initial-" + product.id,
            batchNumber: 1,
            receivedDate: product.createdAt?.slice(0, 10) || businessToday(),
            remainingQty: product.stock,
            initialQty: product.stock,
            costPrice: product.costPrice,
            sellingPrice: product.sellingPrice,
            createdAt: product.createdAt,
          },
        ];
    let remaining = qty;
    for (const lot of batches) {
      const taken = Math.min(remaining, lot.remainingQty);
      if (taken > 0)
        allocations.push({
          productId: product.id,
          batchId: lot.id,
          quantity: taken,
          costPrice: lot.costPrice,
        });
      remaining -= taken;
    }
    const result = deductFifoStock({ ...product, batches }, qty);
    Object.assign(product, {
      stock: result.newStock,
      batches: result.updatedBatches,
      costPrice: result.newCostPrice,
      status: result.newStock ? "active" : "out_of_stock",
    });
    return result.blendedUnitCost * qty;
  };
  const unchanged =
    previous &&
    previous.itemId === input.itemId &&
    previous.quantity === input.quantity &&
    delivered(previous.status) &&
    delivered(input.status);
  if (previous?.itemId && delivered(previous.status) && !unchanged) {
    for (const allocation of (previous as any).__stockAllocations || []) {
      const product = data.inventory.find(
        (p: InventoryItem) => p.id === allocation.productId,
      );
      const batch = product?.batches?.find(
        (b: any) => b.id === allocation.batchId,
      );
      if (!product || !batch) throw Error("Original stock batch missing");
      batch.remainingQty += allocation.quantity;
      product.stock += allocation.quantity;
      product.costPrice =
        product.batches.find((b: any) => b.remainingQty > 0)?.costPrice ??
        product.costPrice;
      product.status = product.status === "archived" ? "archived" : "active";
    }
  }
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity <= 0 ||
    input.salePrice < 0
  )
    throw Error("Invalid order quantity or price.");
  const catalog = data.inventory.find(
    (p: InventoryItem) => p.id === input.itemId,
  );
  const unitCost = unchanged
    ? previous.unitCost
    : input.itemId && delivered(input.status)
      ? allocate(input.itemId, input.quantity) / input.quantity
      : (catalog?.costPrice ?? input.unitCost);
  const member = data.team_members.find(
    (m: ConfirmationMember) => m.id === input.confirmationMemberId,
  );
  const basePrice = catalog?.sellingPrice ?? input.salePrice;
  const eligible =
    !!member &&
    input.status !== "cancelled" &&
    (delivered(input.status) ||
      (member.rewardTrigger === "confirmed" &&
        ["confirmed", "shipped", "pending_pickup"].includes(input.status)));
  const reward = eligible
    ? calculateMemberReward(
        member.baseReward,
        basePrice,
        input.salePrice,
        input.quantity,
        member.rewardCalculationMode,
      ).totalReward
    : 0;
  const totalRevenue =
      input.salePrice * input.quantity + (input.shippingCharged || 0),
    totalCost =
      unitCost * input.quantity +
      (input.shippingCost || 0) +
      (input.platformFee || 0);
  const netProfit =
    input.status === "cancelled" ? 0 : totalRevenue - totalCost - reward;
  for (const bundle of data.inventory.filter((p: InventoryItem) => p.isBundle))
    bundle.stock = Math.min(
      ...(bundle.bundleItems || []).map((part: any) =>
        Math.floor(
          (data.inventory.find((p: InventoryItem) => p.id === part.itemId)
            ?.stock || 0) / part.quantity,
        ),
      ),
    );
  return {
    ...input,
    id,
    __stockAllocations: unchanged
      ? (previous as any).__stockAllocations
      : allocations,
    createdAt: previous?.createdAt || input.createdAt || now(),
    deliveredDate: delivered(input.status)
      ? input.deliveredDate || previous?.deliveredDate || businessToday()
      : undefined,
    unitCost,
    basePrice,
    confirmationMemberName: member?.name,
    memberReward: reward,
    rewardStatus: eligible
      ? "granted"
      : input.status === "cancelled"
        ? "cancelled"
        : "pending",
    rewardTrigger: member?.rewardTrigger,
    totalRevenue,
    totalCost,
    netProfit: Number(netProfit.toFixed(2)),
    profitMargin: totalRevenue
      ? Number(((100 * netProfit) / totalRevenue).toFixed(1))
      : 0,
  } as Order;
}
function demoOrder(input: OrderInput, id: string, data: any): Order {
 if(!input.items?.length)return demoOrderLegacy(input,id,data);
 const previous:Order|undefined=data.orders.find((o:Order)=>o.id===id);
 const signature=(o:OrderInput)=>JSON.stringify((o.items||[]).map(l=>[l.itemId,l.variantId,l.quantity]));
 const unchanged=previous&&delivered(previous.status)&&delivered(input.status)&&signature(previous)===signature(input);
 if(previous&&delivered(previous.status)&&!unchanged){
  for(const a of (previous as any).__stockAllocations||[]){
   const p=data.inventory.find((p:InventoryItem)=>p.id===a.productId),b=p?.batches?.find((b:any)=>b.id===a.batchId);
   if(!p||!b)throw Error('Original stock batch missing');
   b.remainingQty+=a.quantity;p.stock+=a.quantity;
   if(a.variantId){const v=p.variants?.find((v:any)=>v.id===a.variantId);if(!v)throw Error('Original variant missing');v.stock+=a.quantity;}
   p.costPrice=p.batches.find((b:any)=>b.remainingQty>0)?.costPrice??p.costPrice;
   if(p.status!=='archived')p.status='active';
  }
 }
 const allocations:any[]=[];
 const estimates=quoteLines(input.items,data.inventory);
 const lines=input.items.map((line,index)=>{
  const p=data.inventory.find((p:InventoryItem)=>p.id===line.itemId);
  if(!p)throw Error('Product not found');
  const variant=p.variants?.find((v:any)=>v.id===line.variantId);
  if(p.variants?.length&&!variant)throw Error('Choose a variant');
  if(!Number.isInteger(line.quantity)||line.quantity<=0||!Number.isFinite(line.salePrice)||line.salePrice<0)throw Error('Invalid order quantity or price');
  if(unchanged)return {...line,unitCost:previous!.items![index].unitCost,costTotal:previous!.items![index].costTotal};
  if(delivered(input.status)&&variant){if(variant.stock<line.quantity)throw Error('Not enough stock for '+variant.label);variant.stock-=line.quantity;}
  const result=demoOrderLegacy({...input,items:undefined,...line,confirmationMemberId:undefined,shippingCharged:0,shippingCost:0,platformFee:0},id+'-line-'+index,{...data,orders:[]});
  if(!delivered(input.status))result.unitCost=estimates[index].unitCost;
  allocations.push(...((result as any).__stockAllocations||[]).map((a:any)=>({...a,variantId:line.variantId,lineIndex:index})));
  return {...line,itemTitle:p.title,variantLabel:variant?.label,basePrice:p.sellingPrice,unitCost:result.unitCost,costTotal:Math.round(result.unitCost*line.quantity*100)/100};
 });
 const quantity=lines.reduce((n,l)=>n+l.quantity,0),revenue=lines.reduce((n,l)=>n+l.salePrice*l.quantity,0)+(input.shippingCharged||0),cost=lines.reduce((n,l)=>n+(l.costTotal??l.unitCost*l.quantity),0)+(input.shippingCost||0)+(input.platformFee||0);
 const member=data.team_members.find((m:ConfirmationMember)=>m.id===input.confirmationMemberId);
 const stages=['new','confirmed','shipped','delivered'];const stage=delivered(input.status)?'delivered':input.status==='pending_pickup'?'confirmed':input.status;
 const eligible=!!member&&stage!=='cancelled'&&stages.indexOf(stage)>=stages.indexOf(member.rewardTrigger||'delivered');
 const sameTerms=previous&&previous.confirmationMemberId===input.confirmationMemberId&&previous.rewardStatus==='granted'&&previous.items?.every((l,i)=>l.salePrice===lines[i]?.salePrice&&l.quantity===lines[i]?.quantity&&l.itemId===lines[i]?.itemId);
 const extra=lines.reduce((n,l)=>n+Math.max(0,l.salePrice-(l.basePrice??l.salePrice))*l.quantity,0);
 const reward=eligible?(sameTerms?previous!.memberReward||0:member.baseReward*(member.rewardCalculationMode==='per_item'?quantity:1)+extra):0;
 const profit=input.status==='cancelled'?0:Math.round((revenue-cost-reward)*100)/100;
 return {...input,id,items:lines,itemId:lines[0].itemId,itemTitle:lines.map(l=>l.itemTitle).join(' + '),quantity,salePrice:(revenue-(input.shippingCharged||0))/quantity,unitCost:lines.reduce((n,l)=>n+(l.costTotal??l.unitCost*l.quantity),0)/quantity,totalRevenue:revenue,totalCost:cost,netProfit:profit,profitMargin:revenue?profit/revenue*100:0,confirmationMemberName:member?.name,memberReward:reward,memberExtraReward:extra,rewardStatus:eligible?'granted':input.status==='cancelled'?'cancelled':'pending',rewardTrigger:member?.rewardTrigger,createdAt:previous?.createdAt||input.createdAt||now(),deliveredDate:delivered(input.status)?input.deliveredDate||previous?.deliveredDate||businessToday():undefined,__stockAllocations:unchanged?(previous as any).__stockAllocations:allocations} as Order;
}

export async function saveOrder(input: OrderInput, id?: string) {
  const orderId = id || uuid();
  if (isDemo) {
    demoUpdate((data) => {
      const saved = demoOrder(input, orderId, data);
      data.orders = data.orders.filter((o) => o.id !== orderId);
      data.orders.unshift(saved);
    });
    return orderId;
  }
  const payload=toDatabase(input as any);
  if('confirmationMemberId' in input&&!input.confirmationMemberId)payload.confirmation_member_id=null;
  await rpc("save_order", {order_id:orderId,order_data:payload});
  return orderId;
}
export async function readOrder(id: string): Promise<Order> {
  if (isDemo) {
    const found = demoRead("orders").find((o) => o.id === id);
    if (!found) throw Error("Order not found");
    return found;
  }
  const { data, error } = await requireWorkspace().client.rpc(
    "read_workspace_records",
    {
      target_workspace: requireWorkspace().workspaceId,
      table_name: "orders",
      entity_id: id,
      page_offset: 0,
      page_size: 1,
    },
  );
  if (error) throw error;
  if (!data?.rows?.length) throw Error("Order not found");
  return fromDatabase<Order>(data.rows[0]);
}
export async function deleteOrder(id: string) {
  if (isDemo) {
    demoUpdate((data) => {
      const old = data.orders.find((o) => o.id === id);
      if (old) {
        demoOrder({ ...old, status: "cancelled" }, id, data);
        data.orders = data.orders.filter((o) => o.id !== id);
      }
    });
    return;
  }
  await rpc("delete_order", { order_id: id });
}
export async function batchImportOrders(orders: Array<Omit<Order, "id">>) {
  if (isDemo) {
    demoUpdate((data) => {
      for (const order of orders)
        data.orders.unshift(demoOrder(order, uuid(), data));
    });
    return orders.length;
  }
  return rpc("import_orders", {
    order_rows: orders.map((order) => toDatabase(order as any)),
  });
}
export const saveVendor = (value: Omit<Vendor, "id">, id?: string) =>
  upsert<Vendor>("vendors", value, id);
export const deleteVendor = (id: string) => remove("vendors", id);
export const saveTeamMember = (
  value: Omit<ConfirmationMember, "id">,
  id?: string,
) => upsert<ConfirmationMember>("team_members", value, id);
export const deleteTeamMember = (id: string) => remove("team_members", id);
export async function recordTeamPayout(
  value: Omit<TeamPayout, "id">,
  id?: string,
) {
  const payoutId = id || uuid();
  if (value.amount <= 0 || !Number.isFinite(value.amount))
    throw Error("Enter a positive payout amount.");
  if (isDemo) {
    demoUpdate((data) => {
      if (data.team_payouts.some((p) => p.id === payoutId)) return;
      data.team_payouts.unshift({ ...value, id: payoutId });
      const member = data.team_members.find((m) => m.id === value.memberId);
      if (!member) throw Error("Employee not found");
      member.totalPaid = (member.totalPaid || 0) + value.amount;
    });
    return payoutId;
  }
  await rpc("record_payout", {
    payout_id: payoutId,
    payout: toDatabase(value as any),
  });
  return payoutId;
}
export async function deleteTeamPayout(
  id: string,
  _memberId: string,
  _amount: number,
) {
  if (isDemo) {
    demoUpdate((data) => {
      const old = data.team_payouts.find((p) => p.id === id);
      if (!old) return;
      data.team_payouts = data.team_payouts.filter((p) => p.id !== id);
      const member = data.team_members.find((m) => m.id === old.memberId);
      if (member) member.totalPaid = (member.totalPaid || 0) - old.amount;
    });
    return;
  }
  await rpc("delete_payout", { payout_id: id });
}
export async function seedDemoData() {
  if (!isDemo)
    throw Error("Sample seeding is available only in local demo mode.");
  demoReset();
}

export const subscribeToDailyCosts=(cb:(costs:DailyDeliveryCost[])=>void,onError?:(e:Error)=>void)=>subscribe<DailyDeliveryCost>("daily_delivery_costs",cb,onError);
export async function saveDailyDeliveryCost(date:string,amount:number){
 if(!date||!Number.isFinite(amount)||amount<0)throw Error("Enter a valid date and cost.");
 if(isDemo){demoUpdate(data=>{const i=data.daily_delivery_costs.findIndex(c=>c.date===date);const row={id:date,date,amount};if(i>=0)data.daily_delivery_costs[i]=row;else data.daily_delivery_costs.push(row);});return;}
 await rpc("save_daily_delivery_cost",{cost_date:date,cost_amount:amount});
}
export const inventoryHistory=(id:string)=>rpc("inventory_history",{product_id:id});
