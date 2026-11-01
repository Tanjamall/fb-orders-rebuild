import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateComparisonRanges,
  calculatePeriodStats,
  calculateDelta,
  calculateProductPerformance,
  calculateCategoryBreakdown,
} from './analyticsComparison';
import { InventoryItem, Order } from '../types';

describe('analyticsComparison pure logic', () => {
  it('correctly calculates 7d and 30d comparison ranges', () => {
    const anchor = new Date(2026, 9, 28); // 2026-10-28
    const range7d = calculateComparisonRanges('7d', anchor);
    assert.equal(range7d.current.end, '2026-10-28');
    assert.equal(range7d.current.start, '2026-10-22');
    assert.equal(range7d.prior.end, '2026-10-21');
    assert.equal(range7d.prior.start, '2026-10-15');

    const range30d = calculateComparisonRanges('30d', anchor);
    assert.equal(range30d.current.end, '2026-10-28');
    assert.equal(range30d.prior.end, '2026-09-28');
  });

  it('correctly calculates period stats and ignores cancelled orders', () => {
    const sampleOrders: Order[] = [
      {
        id: 'ord1',
        itemId: 'item1',
        itemTitle: 'iPhone',
        quantity: 1,
        unitCost: 400,
        salePrice: 600,
        shippingCharged: 10,
        shippingCost: 8,
        platformFee: 15,
        totalRevenue: 610,
        totalCost: 423,
        netProfit: 187,
        profitMargin: 30.6,
        buyerName: 'Alice',
        paymentMethod: 'cash',
        fulfillmentType: 'local_pickup',
        status: 'completed',
        date: '2026-10-25',
        createdAt: '2026-10-25T10:00:00Z',
      },
      {
        id: 'ord2',
        itemId: 'item2',
        itemTitle: 'AirPods',
        quantity: 2,
        unitCost: 100,
        salePrice: 150,
        shippingCharged: 0,
        shippingCost: 0,
        platformFee: 0,
        totalRevenue: 300,
        totalCost: 200,
        netProfit: 100,
        profitMargin: 33.3,
        buyerName: 'Bob',
        paymentMethod: 'cash',
        fulfillmentType: 'shipping',
        status: 'completed',
        date: '2026-10-26',
        createdAt: '2026-10-26T10:00:00Z',
      },
      {
        id: 'ord3_cancelled',
        itemId: 'item1',
        itemTitle: 'iPhone',
        quantity: 1,
        unitCost: 400,
        salePrice: 600,
        shippingCharged: 0,
        shippingCost: 0,
        platformFee: 0,
        totalRevenue: 600,
        totalCost: 400,
        netProfit: 200,
        profitMargin: 33.3,
        buyerName: 'Charlie',
        paymentMethod: 'cash',
        fulfillmentType: 'local_pickup',
        status: 'cancelled',
        date: '2026-10-27',
        createdAt: '2026-10-27T10:00:00Z',
      },
    ];

    const stats = calculatePeriodStats(sampleOrders);
    assert.equal(stats.ordersCount, 2);
    assert.equal(stats.cancelledCount, 1);
    assert.equal(stats.unitsSold, 3);
    assert.equal(stats.revenue, 910);
    assert.equal(stats.netProfit, 287);
    assert.equal(stats.aov, 455);
    assert.equal(stats.shippingRevenue, 10);
    assert.equal(stats.shippingCost, 8);
    assert.equal(stats.shippingProfit, 2);
  });

  it('correctly calculates deltas and percentage changes', () => {
    // 500 vs 400 -> +25%
    const up = calculateDelta(500, 400);
    assert.equal(up.delta, 100);
    assert.equal(up.percentChange, 25);
    assert.equal(up.isIncrease, true);

    // 300 vs 400 -> -25%
    const down = calculateDelta(300, 400);
    assert.equal(down.delta, -100);
    assert.equal(down.percentChange, -25);
    assert.equal(down.isIncrease, false);

    // 0 vs 0 -> 0%
    const zero = calculateDelta(0, 0);
    assert.equal(zero.delta, 0);
    assert.equal(zero.percentChange, 0);
    assert.equal(zero.isNeutral, true);

    // 100 vs 0 -> 100%
    const fromZero = calculateDelta(100, 0);
    assert.equal(fromZero.percentChange, 100);
  });

  it('calculates product performance and stock days remaining', () => {
    const inventory: InventoryItem[] = [
      {
        id: 'item1',
        title: 'iPhone 14 Pro',
        category: 'Electronics',
        condition: 'like_new',
        costPrice: 400,
        sellingPrice: 600,
        stock: 4,
        lowStockThreshold: 2,
        status: 'active',
        fulfillmentType: 'both',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      },
      {
        id: 'item2',
        title: 'Vintage Chair',
        category: 'Furniture',
        condition: 'good',
        costPrice: 100,
        sellingPrice: 250,
        stock: 0,
        lowStockThreshold: 1,
        status: 'out_of_stock',
        fulfillmentType: 'local',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ];

    const curOrders: Order[] = [
      {
        id: 'o1',
        itemId: 'item1',
        itemTitle: 'iPhone 14 Pro',
        quantity: 2,
        unitCost: 400,
        salePrice: 600,
        shippingCharged: 0,
        shippingCost: 0,
        platformFee: 0,
        totalRevenue: 1200,
        totalCost: 800,
        netProfit: 400,
        profitMargin: 33.3,
        buyerName: 'Buyer 1',
        paymentMethod: 'cash',
        fulfillmentType: 'local_pickup',
        status: 'completed',
        date: '2026-10-20',
        createdAt: '2026-10-20T10:00:00Z',
      },
    ];

    const priorOrders: Order[] = [
      {
        id: 'p1',
        itemId: 'item1',
        itemTitle: 'iPhone 14 Pro',
        quantity: 1,
        unitCost: 400,
        salePrice: 600,
        shippingCharged: 0,
        shippingCost: 0,
        platformFee: 0,
        totalRevenue: 600,
        totalCost: 400,
        netProfit: 200,
        profitMargin: 33.3,
        buyerName: 'Buyer 0',
        paymentMethod: 'cash',
        fulfillmentType: 'local_pickup',
        status: 'completed',
        date: '2026-10-10',
        createdAt: '2026-10-10T10:00:00Z',
      },
    ];

    const perf = calculateProductPerformance(inventory, curOrders, priorOrders, 10);
    assert.equal(perf.length, 2);

    const iphone = perf.find((p) => p.itemId === 'item1')!;
    assert.equal(iphone.unitsSold, 2);
    assert.equal(iphone.priorUnitsSold, 1);
    assert.equal(iphone.unitsChangePct, 100);
    assert.equal(iphone.revenue, 1200);
    assert.equal(iphone.profit, 400);
    // 2 units sold over 10 days = 0.2 units/day. 4 in stock / 0.2 = 20 days.
    assert.equal(iphone.velocityPerDay, 0.2);
    assert.equal(iphone.daysOfStock, 20);
    assert.equal(iphone.stockHealth, 'healthy');

    const chair = perf.find((p) => p.itemId === 'item2')!;
    assert.equal(chair.stockHealth, 'out_of_stock');
  });

  it('calculates category breakdown', () => {
    const inventory: InventoryItem[] = [
      { id: 'i1', title: 'iPhone', category: 'Electronics', condition: 'new', costPrice: 400, sellingPrice: 600, stock: 2, lowStockThreshold: 2, status: 'active', fulfillmentType: 'both', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' },
      { id: 'i2', title: 'Table', category: 'Furniture', condition: 'good', costPrice: 50, sellingPrice: 150, stock: 1, lowStockThreshold: 1, status: 'active', fulfillmentType: 'local', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' }
    ];

    const orders: Order[] = [
      { id: 'o1', itemId: 'i1', itemTitle: 'iPhone', quantity: 1, unitCost: 400, salePrice: 600, shippingCharged: 0, shippingCost: 0, platformFee: 0, totalRevenue: 600, totalCost: 400, netProfit: 200, profitMargin: 33.3, buyerName: 'A', paymentMethod: 'cash', fulfillmentType: 'local_pickup', status: 'completed', date: '2026-10-20', createdAt: '2026-10-20T10:00:00Z' },
      { id: 'o2', itemId: 'i2', itemTitle: 'Table', quantity: 1, unitCost: 50, salePrice: 150, shippingCharged: 0, shippingCost: 0, platformFee: 0, totalRevenue: 150, totalCost: 50, netProfit: 100, profitMargin: 66.7, buyerName: 'B', paymentMethod: 'cash', fulfillmentType: 'local_pickup', status: 'completed', date: '2026-10-21', createdAt: '2026-10-21T10:00:00Z' }
    ];

    const cats = calculateCategoryBreakdown(orders, inventory);
    assert.equal(cats.length, 2);
    assert.equal(cats[0].name, 'Electronics');
    assert.equal(cats[0].revenue, 600);
    assert.equal(cats[1].name, 'Furniture');
    assert.equal(cats[1].revenue, 150);
  });
});
