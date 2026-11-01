import {test} from 'node:test';import assert from 'node:assert/strict';import {quoteLines,productOrderLines} from './orderLines';import {calculatePeriodStats} from './analyticsComparison';
test('bundle preview consumes component FIFO estimates without double-using lots',()=>{
 const inventory:any=[{id:'part',title:'Part',costPrice:50,sellingPrice:80,stock:3,batches:[{batchNumber:1,remainingQty:1,costPrice:30},{batchNumber:2,remainingQty:2,costPrice:50}]},{id:'pack',title:'Pack',costPrice:0,sellingPrice:160,stock:1,isBundle:true,bundleItems:[{itemId:'part',quantity:2}]}];
 const lines=quoteLines([{itemId:'pack',itemTitle:'Pack',quantity:1,salePrice:160,unitCost:0},{itemId:'part',itemTitle:'Part',quantity:1,salePrice:80,unitCost:0}],inventory);
 assert.equal(lines[0].costTotal,80);assert.equal(lines[1].costTotal,50);assert.equal(inventory[0].batches[0].remainingQty,1);
});
test('product line attribution reconciles costs and shared day costs stay business-level',()=>{
 const order:any={id:'order',status:'delivered',quantity:2,shippingCost:5,platformFee:1,memberReward:10,totalRevenue:300,totalCost:126,netProfit:164,items:[{itemId:'a',itemTitle:'A',quantity:1,salePrice:100,unitCost:40},{itemId:'b',itemTitle:'B',quantity:1,salePrice:200,unitCost:80}]};
 assert.equal(productOrderLines([order]).reduce((n,o)=>n+o.netProfit,0),164);
 const stats=calculatePeriodStats([order],[{id:'cost',date:'2026-10-31',amount:20}]);assert.equal(stats.netProfit,144);assert.equal(stats.ordersCount,1);
});
