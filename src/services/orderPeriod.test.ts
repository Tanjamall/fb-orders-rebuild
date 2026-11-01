import {test} from 'node:test';import assert from 'node:assert/strict';import {isCarryOver,matchesOrderPeriod,carryOverLabel} from './orderPeriod';import type {Order} from '../types';
const order=(status:Order['status'],date='2026-10-31',deliveredDate?:string)=>({status,date,deliveredDate} as Order);
test('new month includes all older open statuses and excludes old final statuses',()=>{
 for(const status of ['new','confirmed','pending_pickup','shipped'] as const){assert.equal(matchesOrderPeriod(order(status),'this_month','2026-11-01'),true);assert.equal(isCarryOver(order(status),'2026-11'),true);}
 for(const status of ['delivered','completed','cancelled'] as const){assert.equal(matchesOrderPeriod(order(status),'this_month','2026-11-01'),false);assert.equal(isCarryOver(order(status),'2026-11'),false);}
 assert.equal(matchesOrderPeriod(order('confirmed','2026-09-15'),'this_month','2026-11-01'),true);
});
test('carry-over never changes historical dates, today filters or realized delivery month',()=>{
 const pending=order('confirmed');assert.equal(matchesOrderPeriod(pending,'last_month','2026-11-01'),true);assert.equal(matchesOrderPeriod(pending,'today','2026-11-01'),false);assert.equal(pending.date,'2026-10-31');
 const delivered=order('delivered','2026-10-31','2026-11-01');assert.equal(matchesOrderPeriod(delivered,'this_month','2026-11-01'),true);assert.equal(matchesOrderPeriod(delivered,'last_month','2026-11-01'),false);assert.equal(isCarryOver(delivered,'2026-11'),false);
 assert.equal(isCarryOver(order('confirmed','2026-11-01'),'2026-11'),false);assert.equal(isCarryOver(order('confirmed','2026-12-01'),'2026-11'),false);
});
test('carry-over labels and year rollover identify the original month',()=>{
 assert.equal(carryOverLabel(order('confirmed'),'2026-11'),'Carried over · Oct');assert.equal(carryOverLabel(order('new','2025-12-31'),'2026-01'),'Carried over · Dec 2025');
 assert.equal(matchesOrderPeriod(order('new','2025-12-31'),'last_month','2026-01-01'),true);assert.equal(carryOverLabel(order('delivered'),'2026-11'),null);
});
