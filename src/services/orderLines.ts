import type {Order,OrderLine,InventoryItem,DailyDeliveryCost} from '../types';
export const orderLines=(order:Order):OrderLine[]=>order.items?.length?order.items:[{itemId:order.itemId,itemTitle:order.itemTitle,quantity:order.quantity,salePrice:order.salePrice,unitCost:order.unitCost,basePrice:order.basePrice}];
export const lineName=(line:OrderLine)=>line.itemTitle+(line.variantLabel?' · '+line.variantLabel:'');
export function productOrderLines(orders:Order[]):Order[] {
 return orders.flatMap(order=>{
  const lines=orderLines(order);
  if(lines.length===1)return [{...order,...lines[0],itemTitle:lines[0].itemTitle,items:lines}];
  const revenue=lines.reduce((n,l)=>n+l.salePrice*l.quantity,0);
  const shared=(order.shippingCost||0)+(order.platformFee||0)+(order.memberReward||0);
  let assigned=0;
  return lines.map((l,index)=>{
   const sales=l.salePrice*l.quantity;const cost=l.costTotal??l.unitCost*l.quantity;
   const share=index===lines.length-1?shared-assigned:Math.round(shared*(revenue?sales/revenue:l.quantity/order.quantity)*100)/100;
   assigned+=share;
   return {...order,...l,itemTitle:l.itemTitle,totalRevenue:sales,totalCost:cost+share,netProfit:Math.round((sales-cost-share)*100)/100,items:[l]};
  });
 });
}
export const sharedDeliveryFor=(costs:DailyDeliveryCost[],start?:string,end?:string)=>costs.filter(c=>(!start||c.date>=start)&&(!end||c.date<=end)).reduce((n,c)=>n+c.amount,0);
export function quoteLines(lines:OrderLine[],inventory:InventoryItem[],historical=false):OrderLine[] {
 const available=new Map(inventory.map(p=>[p.id,{...p,batches:p.batches?.map(b=>({...b}))}]));
 return lines.map(line=>{
  if(historical)return line;
  const p=available.get(line.itemId||'');if(!p)return line;
  const takeCost=(id:string,quantity:number):number=>{
   const product=available.get(id);if(!product)return 0;
   if(product.isBundle)return (product.bundleItems||[]).reduce((n,part)=>n+takeCost(part.itemId,quantity*part.quantity),0);
   let remaining=Math.max(0,quantity),cost=0;
   if(product.batches?.length)for(const batch of [...product.batches].sort((a,b)=>a.batchNumber-b.batchNumber)){
    const take=Math.min(remaining,batch.remainingQty);cost+=take*batch.costPrice;remaining-=take;batch.remainingQty-=take;
   }else{const take=Math.min(remaining,product.stock);cost+=take*product.costPrice;remaining-=take;product.stock-=take;}
   return cost+remaining*product.costPrice;
  };
  const cost=takeCost(p.id,line.quantity);
  return {...line,itemTitle:p.title,basePrice:p.sellingPrice,unitCost:line.quantity>0?cost/line.quantity:p.costPrice,costTotal:Math.round(cost*100)/100,variantLabel:p.variants?.find(v=>v.id===line.variantId)?.label||line.variantLabel,variantName:p.variantName};
 });
}
