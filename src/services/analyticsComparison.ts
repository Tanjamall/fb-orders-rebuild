import {productOrderLines} from "./orderLines";
import type {DailyDeliveryCost} from "../types";
import { InventoryItem, Order } from '../types';

export type TimeFilterPreset = '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface PeriodComparisonRange {
  current: DateRange;
  prior: DateRange;
  currentLabel: string;
  priorLabel: string;
}

export interface PeriodStats {
  revenue: number;
  cogs: number;
  netProfit: number;
  marginPercent: number;
  ordersCount: number;
  unitsSold: number;
  aov: number; // Average Order Value
  avgProfitPerOrder: number;
  shippingRevenue: number;
  shippingCost: number;
  shippingProfit: number;
  cancelledCount: number;
  cancelledRate: number;
  localOrdersCount: number;
  localRevenue: number;
  shippedOrdersCount: number;
  shippedRevenue: number;
}

export interface MetricDelta {
  current: number;
  prior: number;
  delta: number;
  percentChange: number | null; // null if prior is 0 and current is 0
  isIncrease: boolean;
  isNeutral: boolean;
}

export interface ProductPerformanceItem {
  itemId: string;
  title: string;
  category: string;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  status: string;
  unitsSold: number;
  priorUnitsSold: number;
  unitsChangePct: number | null;
  revenue: number;
  priorRevenue: number;
  revenueChangePct: number | null;
  profit: number;
  marginPercent: number;
  velocityPerDay: number;
  daysOfStock: number | null;
  stockHealth: 'out_of_stock' | 'low' | 'healthy' | 'excess';
}

export interface CategoryPerformanceItem {
  name: string;
  revenue: number;
  profit: number;
  units: number;
  margin: number;
  sharePercent: number;
}

/**
 * Format a Date to 'YYYY-MM-DD' in local date numbers.
 */
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a 'YYYY-MM-DD' into a local Date object.
 */
export function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Determine the reference date to anchor relative filters (7d, 30d, etc.).
 * If the dataset contains orders newer than today (e.g. demo data), use the latest order date.
 */
export function getAnchorDate(orders: Order[]): Date {
  const now = new Date();
  if (!orders || orders.length === 0) return now;

  let maxOrderTime = 0;
  for (const o of orders) {
    const raw = o.date || (o.createdAt ? o.createdAt.substring(0, 10) : '');
    if (raw && raw.length >= 10) {
      const t = parseDate(raw.substring(0, 10)).getTime();
      if (!isNaN(t) && t > maxOrderTime) {
        maxOrderTime = t;
      }
    }
  }

  if (maxOrderTime > now.getTime()) {
    return new Date(maxOrderTime);
  }
  return now;
}

/**
 * Calculate the current and prior date ranges based on preset.
 */
export function calculateComparisonRanges(
  preset: TimeFilterPreset,
  anchorDate: Date,
  customStart?: string,
  customEnd?: string
): PeriodComparisonRange {
  const anchor = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());

  if (preset === '7d') {
    const curEnd = new Date(anchor);
    const curStart = new Date(anchor);
    curStart.setDate(curStart.getDate() - 6);

    const priorEnd = new Date(curStart);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorStart.getDate() - 6);

    return {
      current: { start: formatDate(curStart), end: formatDate(curEnd) },
      prior: { start: formatDate(priorStart), end: formatDate(priorEnd) },
      currentLabel: 'Last 7 Days',
      priorLabel: 'Prior 7 Days',
    };
  }

  if (preset === '30d') {
    const curEnd = new Date(anchor);
    const curStart = new Date(anchor);
    curStart.setDate(curStart.getDate() - 29);

    const priorEnd = new Date(curStart);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorStart.getDate() - 29);

    return {
      current: { start: formatDate(curStart), end: formatDate(curEnd) },
      prior: { start: formatDate(priorStart), end: formatDate(priorEnd) },
      currentLabel: 'Last 30 Days',
      priorLabel: 'Prior 30 Days',
    };
  }

  if (preset === '90d') {
    const curEnd = new Date(anchor);
    const curStart = new Date(anchor);
    curStart.setDate(curStart.getDate() - 89);

    const priorEnd = new Date(curStart);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorStart.getDate() - 89);

    return {
      current: { start: formatDate(curStart), end: formatDate(curEnd) },
      prior: { start: formatDate(priorStart), end: formatDate(priorEnd) },
      currentLabel: 'Last 90 Days',
      priorLabel: 'Prior 90 Days',
    };
  }

  if (preset === 'ytd') {
    const curStart = new Date(anchor.getFullYear(), 0, 1);
    const curEnd = new Date(anchor);

    const priorStart = new Date(anchor.getFullYear() - 1, 0, 1);
    const priorEnd = new Date(anchor.getFullYear() - 1, anchor.getMonth(), anchor.getDate());

    return {
      current: { start: formatDate(curStart), end: formatDate(curEnd) },
      prior: { start: formatDate(priorStart), end: formatDate(priorEnd) },
      currentLabel: `YTD ${anchor.getFullYear()}`,
      priorLabel: `Same Period ${anchor.getFullYear() - 1}`,
    };
  }

  if (preset === 'custom' && customStart && customEnd) {
    const curStart = parseDate(customStart);
    const curEnd = parseDate(customEnd);
    const daySpan = Math.max(1, Math.round((curEnd.getTime() - curStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const priorEnd = new Date(curStart);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorStart.getDate() - (daySpan - 1));

    return {
      current: { start: customStart, end: customEnd },
      prior: { start: formatDate(priorStart), end: formatDate(priorEnd) },
      currentLabel: `${customStart} - ${customEnd}`,
      priorLabel: `Prior ${daySpan} Days`,
    };
  }

  // Preset 'all'
  return {
    current: { start: '1970-01-01', end: '2099-12-31' },
    prior: { start: '1970-01-01', end: '1970-01-01' },
    currentLabel: 'All Time',
    priorLabel: 'All Historical',
  };
}

/**
 * Filter orders strictly belonging to a date range.
 */
export function filterOrdersByRange(orders: Order[], range: DateRange): Order[] {
  return orders.filter((o) => {
    // Delivered orders realize profit on the delivery date
    const d = (o.status === 'delivered' || o.status === 'completed') && o.deliveredDate
      ? o.deliveredDate
      : (o.date || (o.createdAt ? o.createdAt.substring(0, 10) : ''));
    if (!d) return false;
    return d >= range.start && d <= range.end;
  });
}

/**
 * Calculate comprehensive period summary stats.
 */
export function calculatePeriodStats(orders: Order[],dailyCosts:DailyDeliveryCost[]=[]): PeriodStats {
  let revenue = 0;
  let cogs = 0;
  let netProfit = 0;
  let ordersCount = 0;
  let unitsSold = 0;
  let shippingRevenue = 0;
  let shippingCost = 0;
  let cancelledCount = 0;
  let localOrdersCount = 0;
  let localRevenue = 0;
  let shippedOrdersCount = 0;
  let shippedRevenue = 0;

  for (const o of orders) {
    if (o.status === 'cancelled') {
      cancelledCount += 1;
      continue;
    }

    if(!['delivered','completed'].includes(o.status))continue;
    ordersCount += 1;
    revenue += o.totalRevenue || 0;
    cogs += o.totalCost || 0;
    netProfit += o.netProfit || 0;
    unitsSold += o.quantity || 1;
    shippingRevenue += o.shippingCharged || 0;
    shippingCost += o.shippingCost || 0;

    if (o.fulfillmentType === 'shipping') {
      shippedOrdersCount += 1;
      shippedRevenue += o.totalRevenue || 0;
    } else {
      localOrdersCount += 1;
      localRevenue += o.totalRevenue || 0;
    }
  }

  const sharedDelivery=dailyCosts.reduce((n,c)=>n+c.amount,0);
  netProfit-=sharedDelivery;cogs+=sharedDelivery;shippingCost+=sharedDelivery;
  const marginPercent = revenue > 0 ? Number(((netProfit / revenue) * 100).toFixed(1)) : 0;
  const aov = ordersCount > 0 ? Number((revenue / ordersCount).toFixed(2)) : 0;
  const avgProfitPerOrder = ordersCount > 0 ? Number((netProfit / ordersCount).toFixed(2)) : 0;
  const shippingProfit = Number((shippingRevenue - shippingCost).toFixed(2));
  const totalAttempts = orders.length;
  const cancelledRate = totalAttempts > 0 ? Number(((cancelledCount / totalAttempts) * 100).toFixed(1)) : 0;

  return {
    revenue: Number(revenue.toFixed(2)),
    cogs: Number(cogs.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    marginPercent,
    ordersCount,
    unitsSold,
    aov,
    avgProfitPerOrder,
    shippingRevenue: Number(shippingRevenue.toFixed(2)),
    shippingCost: Number(shippingCost.toFixed(2)),
    shippingProfit,
    cancelledCount,
    cancelledRate,
    localOrdersCount,
    localRevenue: Number(localRevenue.toFixed(2)),
    shippedOrdersCount,
    shippedRevenue: Number(shippedRevenue.toFixed(2)),
  };
}

/**
 * Compare two metric values and compute delta and % change.
 */
export function calculateDelta(current: number, prior: number): MetricDelta {
  const delta = Number((current - prior).toFixed(2));
  if (prior === 0) {
    if (current === 0) {
      return { current, prior, delta: 0, percentChange: 0, isIncrease: false, isNeutral: true };
    }
    return { current, prior, delta, percentChange: current > 0 ? 100 : -100, isIncrease: current > 0, isNeutral: false };
  }
  const pct = Number((((current - prior) / Math.abs(prior)) * 100).toFixed(1));
  return {
    current,
    prior,
    delta,
    percentChange: pct,
    isIncrease: delta > 0,
    isNeutral: delta === 0,
  };
}

/**
 * Calculate Product Performance table & stock velocity.
 */
export function calculateProductPerformance(
  allInventory: InventoryItem[],
  currentOrders: Order[],
  priorOrders: Order[],
  periodDays: number = 30
): ProductPerformanceItem[] {
  // Aggregate sales in current period
  const curMap = new Map<string, { units: number; revenue: number; profit: number; title: string }>();
  for (const o of productOrderLines(currentOrders)) {
    if (!['delivered','completed'].includes(o.status)) continue;
    const key = o.itemId || o.itemTitle;
    const prev = curMap.get(key) || { units: 0, revenue: 0, profit: 0, title: o.itemTitle };
    curMap.set(key, {
      units: prev.units + (o.quantity || 1),
      revenue: prev.revenue + (o.totalRevenue || 0),
      profit: prev.profit + (o.netProfit || 0),
      title: o.itemTitle || prev.title,
    });
  }

  // Aggregate sales in prior period
  const priorMap = new Map<string, { units: number; revenue: number; profit: number }>();
  for (const o of productOrderLines(priorOrders)) {
    if (!['delivered','completed'].includes(o.status)) continue;
    const key = o.itemId || o.itemTitle;
    const prev = priorMap.get(key) || { units: 0, revenue: 0, profit: 0 };
    priorMap.set(key, {
      units: prev.units + (o.quantity || 1),
      revenue: prev.revenue + (o.totalRevenue || 0),
      profit: prev.profit + (o.netProfit || 0),
    });
  }

  // Build items list from both active inventory and any sold items
  const items: ProductPerformanceItem[] = [];
  const processedKeys = new Set<string>();

  // 1. Process from inventory
  for (const inv of allInventory) {
    processedKeys.add(inv.id);
    const cur = curMap.get(inv.id) || curMap.get(inv.title) || { units: 0, revenue: 0, profit: 0, title: inv.title };
    const pri = priorMap.get(inv.id) || priorMap.get(inv.title) || { units: 0, revenue: 0, profit: 0 };

    const unitsSold = cur.units;
    const priorUnitsSold = pri.units;
    const revenue = Number(cur.revenue.toFixed(2));
    const priorRevenue = Number(pri.revenue.toFixed(2));
    const profit = Number(cur.profit.toFixed(2));
    const marginPercent = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;

    const unitsChangePct = priorUnitsSold === 0 ? (unitsSold > 0 ? 100 : null) : Number((((unitsSold - priorUnitsSold) / priorUnitsSold) * 100).toFixed(1));
    const revenueChangePct = priorRevenue === 0 ? (revenue > 0 ? 100 : null) : Number((((revenue - priorRevenue) / priorRevenue) * 100).toFixed(1));

    const effectiveDays = Math.max(1, periodDays);
    const velocityPerDay = Number((unitsSold / effectiveDays).toFixed(2));
    const currentStock = inv.stock ?? 0;

    let daysOfStock: number | null = null;
    let stockHealth: 'out_of_stock' | 'low' | 'healthy' | 'excess' = 'healthy';

    if (currentStock <= 0) {
      stockHealth = 'out_of_stock';
      daysOfStock = 0;
    } else if (velocityPerDay > 0) {
      daysOfStock = Math.round(currentStock / velocityPerDay);
      if (daysOfStock <= 7) {
        stockHealth = 'low';
      } else if (daysOfStock > 60) {
        stockHealth = 'excess';
      } else {
        stockHealth = 'healthy';
      }
    } else {
      // 0 sales in period but has stock
      if (currentStock <= (inv.lowStockThreshold ?? 2)) {
        stockHealth = 'low';
      } else {
        stockHealth = 'healthy';
      }
    }

    items.push({
      itemId: inv.id,
      title: inv.title,
      category: inv.category || 'General',
      currentStock,
      costPrice: inv.costPrice,
      sellingPrice: inv.sellingPrice,
      status: inv.status,
      unitsSold,
      priorUnitsSold,
      unitsChangePct,
      revenue,
      priorRevenue,
      revenueChangePct,
      profit,
      marginPercent,
      velocityPerDay,
      daysOfStock,
      stockHealth,
    });
  }

  // 2. Add any items from orders that may not be in current inventory (e.g. historical deleted items)
  for (const [key, cur] of curMap.entries()) {
    if (!processedKeys.has(key)) {
      const pri = priorMap.get(key) || { units: 0, revenue: 0, profit: 0 };
      const revenue = Number(cur.revenue.toFixed(2));
      const priorRevenue = Number(pri.revenue.toFixed(2));
      const profit = Number(cur.profit.toFixed(2));
      const marginPercent = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;
      const unitsChangePct = pri.units === 0 ? 100 : Number((((cur.units - pri.units) / pri.units) * 100).toFixed(1));
      const revenueChangePct = priorRevenue === 0 ? 100 : Number((((revenue - priorRevenue) / priorRevenue) * 100).toFixed(1));

      items.push({
        itemId: key,
        title: cur.title,
        category: 'Marketplace',
        currentStock: 0,
        costPrice: 0,
        sellingPrice: 0,
        status: 'archived',
        unitsSold: cur.units,
        priorUnitsSold: pri.units,
        unitsChangePct,
        revenue,
        priorRevenue,
        revenueChangePct,
        profit,
        marginPercent,
        velocityPerDay: 0,
        daysOfStock: 0,
        stockHealth: 'out_of_stock',
      });
    }
  }

  // Sort by revenue descending by default
  return items.sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold);
}

/**
 * Category breakdown in current period
 */
export function calculateCategoryBreakdown(
  orders: Order[],
  inventory: InventoryItem[]
): CategoryPerformanceItem[] {
  const invMap = new Map<string, string>();
  for (const item of inventory) {
    invMap.set(item.id, item.category || 'General');
  }

  const map = new Map<string, { revenue: number; profit: number; units: number }>();
  let totalRev = 0;

  for (const o of productOrderLines(orders)) {
    if (!['delivered','completed'].includes(o.status)) continue;
    const cat = (o.itemId && invMap.get(o.itemId)) || 'General';
    const cur = map.get(cat) || { revenue: 0, profit: 0, units: 0 };
    cur.revenue += o.totalRevenue || 0;
    cur.profit += o.netProfit || 0;
    cur.units += o.quantity || 1;
    totalRev += o.totalRevenue || 0;
    map.set(cat, cur);
  }

  return Array.from(map.entries())
    .map(([name, data]) => {
      const margin = data.revenue > 0 ? Number(((data.profit / data.revenue) * 100).toFixed(1)) : 0;
      const share = totalRev > 0 ? Number(((data.revenue / totalRev) * 100).toFixed(1)) : 0;
      return {
        name,
        revenue: Number(data.revenue.toFixed(2)),
        profit: Number(data.profit.toFixed(2)),
        units: data.units,
        margin,
        sharePercent: share,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
