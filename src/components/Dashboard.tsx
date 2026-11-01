import type { DailyDeliveryCost } from "../types";
import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingBag, Truck, Percent, ArrowUpRight, ArrowDownRight, Calendar, ChevronRight, Layers, ArrowUpDown, RotateCcw, Boxes, Minus } from 'lucide-react';
import { InventoryItem, Order } from '../types';
import { useAuth } from '../context/AuthContext';
import { TimeFilterPreset, getAnchorDate, calculateComparisonRanges, filterOrdersByRange, calculatePeriodStats, calculateDelta, calculateProductPerformance, calculateCategoryBreakdown, ProductPerformanceItem, MetricDelta } from '../services/analyticsComparison';
interface DashboardProps {
    dailyCosts?: DailyDeliveryCost[];
    inventory: InventoryItem[];
    orders: Order[];
    onNavigateTab: (tab: string) => void;
    onOpenNewSale?: () => void;
    onOpenNewItem?: () => void;
    onOpenRestock?: (item: InventoryItem) => void;
}
export const Dashboard: React.FC<DashboardProps> = ({ inventory, orders, dailyCosts = [], onNavigateTab, onOpenRestock, }) => {
    const { canViewFinancials } = useAuth();
    // Time preset filter
    const [timePreset, setTimePreset] = useState<TimeFilterPreset>('30d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    // Product sorting in performance table
    const [sortField, setSortField] = useState<'revenue' | 'unitsSold' | 'profit' | 'daysOfStock'>('revenue');
    const [sortAsc, setSortAsc] = useState(false);
    // Selected month for interactive bar chart drill-down
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    // 1. Anchor date and comparison ranges
    const anchorDate = useMemo(() => getAnchorDate(orders), [orders]);
    const ranges = useMemo(() => {
        return calculateComparisonRanges(timePreset, anchorDate, customStart, customEnd);
    }, [timePreset, anchorDate, customStart, customEnd]);
    // 2. Orders filtered into current and prior periods
    const currentOrders = useMemo(() => {
        return filterOrdersByRange(orders, ranges.current);
    }, [orders, ranges.current]);
    const priorOrders = useMemo(() => {
        return filterOrdersByRange(orders, ranges.prior);
    }, [orders, ranges.prior]);
    // 3. Compute comprehensive stats for both periods
    const currentStats = useMemo(() => calculatePeriodStats(currentOrders, dailyCosts.filter(c => c.date >= ranges.current.start && c.date <= ranges.current.end)), [currentOrders, dailyCosts, ranges.current]);
    const priorStats = useMemo(() => calculatePeriodStats(priorOrders, dailyCosts.filter(c => c.date >= ranges.prior.start && c.date <= ranges.prior.end)), [priorOrders, dailyCosts, ranges.prior]);
    // 4. Metric Deltas (Period-over-Period)
    const revenueDelta = useMemo(() => calculateDelta(currentStats.revenue, priorStats.revenue), [currentStats.revenue, priorStats.revenue]);
    const profitDelta = useMemo(() => calculateDelta(currentStats.netProfit, priorStats.netProfit), [currentStats.netProfit, priorStats.netProfit]);
    const marginDelta = useMemo(() => calculateDelta(currentStats.marginPercent, priorStats.marginPercent), [currentStats.marginPercent, priorStats.marginPercent]);
    const ordersDelta = useMemo(() => calculateDelta(currentStats.ordersCount, priorStats.ordersCount), [currentStats.ordersCount, priorStats.ordersCount]);
    const unitsDelta = useMemo(() => calculateDelta(currentStats.unitsSold, priorStats.unitsSold), [currentStats.unitsSold, priorStats.unitsSold]);
    const aovDelta = useMemo(() => calculateDelta(currentStats.aov, priorStats.aov), [currentStats.aov, priorStats.aov]);
    const avgProfitDelta = useMemo(() => calculateDelta(currentStats.avgProfitPerOrder, priorStats.avgProfitPerOrder), [currentStats.avgProfitPerOrder, priorStats.avgProfitPerOrder]);
    const shippingProfitDelta = useMemo(() => calculateDelta(currentStats.shippingProfit, priorStats.shippingProfit), [currentStats.shippingProfit, priorStats.shippingProfit]);
    // 5. Inventory & Sell-Through Stats
    const activeStockUnits = useMemo(() => inventory.filter(i=>!i.isBundle).reduce((sum, i) => sum + (i.stock || 0), 0), [inventory]);
    const inventoryCostValue = useMemo(() => inventory.filter(i=>!i.isBundle).reduce((sum, i) => sum + (i.batches?.length?i.batches.reduce((n,b)=>n+b.remainingQty*b.costPrice,0):i.costPrice*(i.stock||0)), 0), [inventory]);
    const inventoryRetailValue = useMemo(() => inventory.filter(i=>!i.isBundle).reduce((sum, i) => sum + (i.sellingPrice * (i.stock || 0)), 0), [inventory]);
    const sellThroughRate = useMemo(() => {
        const totalPotential = currentStats.unitsSold + activeStockUnits;
        if (totalPotential === 0)
            return 0;
        return Number(((currentStats.unitsSold / totalPotential) * 100).toFixed(1));
    }, [currentStats.unitsSold, activeStockUnits]);
    // Effective days for velocity
    const periodDaysCount = useMemo(() => {
        if (timePreset === '7d')
            return 7;
        if (timePreset === '30d')
            return 30;
        if (timePreset === '90d')
            return 90;
        if (timePreset === 'ytd') {
            const curYear = anchorDate.getFullYear();
            const jan1 = new Date(curYear, 0, 1);
            return Math.max(1, Math.round((anchorDate.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24)));
        }
        return 30;
    }, [timePreset, anchorDate]);
    // 6. Product Performance Calculation & Sorting
    const productPerformance = useMemo(() => {
        const raw = calculateProductPerformance(inventory, currentOrders, priorOrders, periodDaysCount);
        return raw.sort((a, b) => {
            let valA: number = 0;
            let valB: number = 0;
            if (sortField === 'revenue') {
                valA = a.revenue;
                valB = b.revenue;
            }
            else if (sortField === 'unitsSold') {
                valA = a.unitsSold;
                valB = b.unitsSold;
            }
            else if (sortField === 'profit') {
                valA = a.profit;
                valB = b.profit;
            }
            else if (sortField === 'daysOfStock') {
                valA = a.daysOfStock ?? 999;
                valB = b.daysOfStock ?? 999;
            }
            return sortAsc ? valA - valB : valB - valA;
        });
    }, [inventory, currentOrders, priorOrders, periodDaysCount, sortField, sortAsc]);
    // 7. Categories Breakdown
    const categoryBreakdown = useMemo(() => {
        return calculateCategoryBreakdown(currentOrders, inventory);
    }, [currentOrders, inventory]);
    // 8. Monthly historical chart data (all recorded orders)
    const monthlyData = useMemo(() => {
        const map = new Map<string, {
            revenue: number;
            cost: number;
            profit: number;
            count: number;
        }>();
        orders.forEach((ord) => {
            if (!['delivered', 'completed'].includes(ord.status))
                return;
            const effectiveDate = (ord.status === 'delivered' || ord.status === 'completed') && ord.deliveredDate
                ? ord.deliveredDate
                : ord.date;
            if (!effectiveDate)
                return;
            const monthKey = effectiveDate.substring(0, 7); // "YYYY-MM"
            const prev = map.get(monthKey) || { revenue: 0, cost: 0, profit: 0, count: 0 };
            map.set(monthKey, {
                revenue: prev.revenue + (ord.totalRevenue || 0),
                cost: prev.cost + (ord.totalCost || 0),
                profit: prev.profit + (ord.netProfit || 0),
                count: prev.count + 1,
            });
        });
        dailyCosts.forEach(c => { const key = c.date.slice(0, 7); const prev = map.get(key) || { revenue: 0, cost: 0, profit: 0, count: 0 }; map.set(key, { ...prev, cost: prev.cost + c.amount, profit: prev.profit - c.amount }); });
        const sortedMonths = Array.from(map.keys()).sort();
        return sortedMonths.map((m) => {
            const d = map.get(m)!;
            const margin = d.revenue > 0 ? Number(((d.profit / d.revenue) * 100).toFixed(1)) : 0;
            return {
                month: m,
                revenue: Number(d.revenue.toFixed(2)),
                cost: Number(d.cost.toFixed(2)),
                profit: Number(d.profit.toFixed(2)),
                ordersCount: d.count,
                marginPercent: margin,
            };
        });
    }, [orders, dailyCosts]);
    const maxMonthlyRevenue = useMemo(() => {
        if (monthlyData.length === 0)
            return 1000;
        return Math.max(...monthlyData.map((d) => d.revenue), 1000);
    }, [monthlyData]);
    // Helper badge for period change
    const renderDeltaBadge = (delta: MetricDelta, suffix: string = '%', isReversed: boolean = false) => {
        if (delta.isNeutral || delta.percentChange === null) {
            return (<span className="inline-flex items-center text-[10px] font-mono tabular-nums font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
          <Minus className="w-3 h-3 mr-0.5"/> 0.0{suffix}
        </span>);
        }
        const isGood = isReversed ? !delta.isIncrease : delta.isIncrease;
        const Icon = delta.isIncrease ? ArrowUpRight : ArrowDownRight;
        const absVal = Math.abs(delta.percentChange);
        return (<span className={`inline-flex items-center text-[10px] font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded-md border ${isGood
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200/80'
                : 'text-rose-700 bg-rose-50 border-rose-200/80'}`}>
        <Icon className="w-3 h-3 mr-0.5 shrink-0"/>
        {delta.isIncrease ? '+' : '-'}{absVal}{suffix}
      </span>);
    };
    const handleToggleSort = (field: 'revenue' | 'unitsSold' | 'profit' | 'daysOfStock') => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        }
        else {
            setSortField(field);
            setSortAsc(false);
        }
    };
    return (<div className="space-y-6 pb-12 w-full max-w-full overflow-hidden">
      
      {/* 1. Header & Filters: Pure Title "Analytics" & Time Filters Up Top */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Analytics
            </h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0"/>
              <span>
                <strong className="text-slate-700 font-semibold">{ranges.currentLabel}</strong>
                {timePreset !== 'all' && (<span className="text-slate-500"> ({ranges.current.start} to {ranges.current.end}) vs {ranges.priorLabel}</span>)}
              </span>
            </div>
          </div>

          {/* Time Filter Segments */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none">
            {([
            { id: '7d', label: '7D' },
            { id: '30d', label: '30D' },
            { id: '90d', label: '90D' },
            { id: 'ytd', label: 'YTD' },
            { id: 'all', label: 'All' },
            { id: 'custom', label: 'Custom' },
        ] as {
            id: TimeFilterPreset;
            label: string;
        }[]).map((tab) => {
            const active = timePreset === tab.id;
            return (<button key={tab.id} onClick={() => setTimePreset(tab.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${active
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}>
                  {tab.label}
                </button>);
        })}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {timePreset === 'custom' && (<div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="font-semibold text-slate-600">Custom Range:</span>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"/>
            <span className="text-slate-400">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"/>
            {(customStart || customEnd) && (<button onClick={() => {
                    setCustomStart('');
                    setCustomEnd('');
                }} className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer ml-1">
                Reset
              </button>)}
          </div>)}
      </div>

      {/* 2. Core KPI Cards with Period-over-Period Comparison */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Gross Revenue */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Revenue
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
              </div>
            </div>
            <div className="mt-2 text-lg sm:text-2xl font-black font-mono tabular-nums text-slate-900 tracking-tight truncate">
              DH {currentStats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1">
            {timePreset !== 'all' ? (renderDeltaBadge(revenueDelta)) : (<span className="text-[11px] text-slate-500">Historical Lifetime</span>)}
            <span className="text-[11px] font-mono tabular-nums text-slate-500 hidden sm:inline">
              Prior: DH {priorStats.revenue.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Net Profit & Margin */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Net Profit
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
              </div>
            </div>
            <div className="mt-2 text-lg sm:text-2xl font-black font-mono tabular-nums text-emerald-700 tracking-tight truncate">
              {canViewFinancials ? (`DH ${currentStats.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : ('••••••')}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1">
            {canViewFinancials ? (<>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold font-mono tabular-nums text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                    {currentStats.marginPercent}%
                  </span>
                  {timePreset !== 'all' && renderDeltaBadge(profitDelta)}
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 hidden sm:inline">
                  Prior: DH {priorStats.netProfit.toFixed(0)}
                </span>
              </>) : (<span className="text-[11px] text-slate-500 italic">Financials hidden</span>)}
          </div>
        </div>

        {/* Orders Count & AOV */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Orders & Units
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-2xl font-black font-mono tabular-nums text-slate-900 tracking-tight">
                {currentStats.ordersCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ({currentStats.unitsSold} units)
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1">
            {timePreset !== 'all' ? (renderDeltaBadge(ordersDelta)) : (<span className="text-[11px] text-slate-500">All orders</span>)}
            <span className="text-[11px] font-mono tabular-nums text-slate-600 font-semibold">
              AOV: DH {currentStats.aov.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Sell-Through & Inventory Velocity */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                Sell-Through Rate
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-2xl font-black font-mono tabular-nums text-slate-900 tracking-tight">
                {sellThroughRate}%
              </span>
              <span className="text-xs text-slate-500">sold in period</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-mono tabular-nums">{activeStockUnits} units in stock</span>
            <span className="font-semibold font-mono tabular-nums text-slate-700">DH {inventoryRetailValue.toFixed(0)} retail</span>
          </div>
        </div>

      </div>

      {/* 3. Secondary Metrics Strip (Average Ticket, Profit Per Order, Shipping Profit, Cancellation Rate) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 text-xs">
        <div className="flex flex-col">
          <span className="text-slate-500 font-medium">Avg Order Value (AOV)</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-bold font-mono tabular-nums text-slate-900">DH {currentStats.aov.toFixed(2)}</span>
            {timePreset !== 'all' && (<span className={`text-[10px] font-mono tabular-nums font-semibold ${aovDelta.isIncrease ? 'text-emerald-700' : 'text-slate-500'}`}>
                {aovDelta.isIncrease ? `+DH ${aovDelta.delta}` : `-DH ${Math.abs(aovDelta.delta)}`}
              </span>)}
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-slate-500 font-medium">Avg Profit per Order</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
              {canViewFinancials ? `DH ${currentStats.avgProfitPerOrder.toFixed(2)}` : '••••'}
            </span>
            {canViewFinancials && timePreset !== 'all' && (<span className={`text-[10px] font-mono tabular-nums font-semibold ${avgProfitDelta.isIncrease ? 'text-emerald-700' : 'text-slate-500'}`}>
                {avgProfitDelta.isIncrease ? `+DH ${avgProfitDelta.delta}` : `-DH ${Math.abs(avgProfitDelta.delta)}`}
              </span>)}
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-slate-500 font-medium">Net Shipping Profit</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-sm font-bold font-mono tabular-nums ${currentStats.shippingProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {currentStats.shippingProfit >= 0 ? `+DH ${currentStats.shippingProfit.toFixed(2)}` : `-DH ${Math.abs(currentStats.shippingProfit).toFixed(2)}`}
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              ({currentStats.shippedOrdersCount} shipped)
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-slate-500 font-medium">Cancellation Rate</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-sm font-bold font-mono tabular-nums ${currentStats.cancelledRate > 10 ? 'text-rose-600' : 'text-slate-900'}`}>
              {currentStats.cancelledRate}%
            </span>
            <span className="text-[10px] text-slate-500">
              ({currentStats.cancelledCount} cancelled)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Product Performance Section (User Requirement: add products performance) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600"/>
              <span>Product Performance</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sales volume, revenue contribution, profit margins, and inventory health for this period.
            </p>
          </div>

          {/* Table Sort Controls */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 self-start sm:self-auto overflow-x-auto max-w-full pb-1 sm:pb-0">
            <span className="text-slate-500 font-medium shrink-0">Sort by:</span>
            {[
            { field: 'revenue', label: 'Revenue' },
            { field: 'unitsSold', label: 'Units' },
            { field: 'profit', label: 'Profit' },
            { field: 'daysOfStock', label: 'Stock Days' },
        ].map((btn) => (<button key={btn.field} onClick={() => handleToggleSort(btn.field as any)} className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 ${sortField === btn.field
                ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                <span>{btn.label}</span>
                {sortField === btn.field && (<ArrowUpDown className="w-3 h-3 text-blue-600"/>)}
              </button>))}
          </div>
        </div>

        {productPerformance.length === 0 ? (<div className="py-12 text-center text-slate-400">
            <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 mb-2"/>
            <p className="text-xs font-medium">No product sales found for this time range.</p>
          </div>) : (<>
            {/* Desktop Table View */}
            <div className="hidden md:block mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                    {canViewFinancials && <th className="py-2.5 px-3 text-right">Net Profit</th>}
                    {canViewFinancials && <th className="py-2.5 px-3 text-right">Margin</th>}
                    <th className="py-2.5 px-3 text-center">In Stock</th>
                    <th className="py-2.5 px-3 text-center">Runway</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productPerformance.map((prod) => {
                const matchedInv = inventory.find((i) => i.id === prod.itemId);
                return (<tr key={prod.itemId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 max-w-xs">
                          <p className="font-semibold text-slate-900 truncate">{prod.title}</p>
                          <span className="text-[11px] text-slate-500">{prod.category}</span>
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className="font-bold text-slate-900">{prod.unitsSold}</span>
                          {prod.unitsChangePct !== null && timePreset !== 'all' && (<span className={`block text-[10px] ${prod.unitsChangePct >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700'}`}>
                              {prod.unitsChangePct >= 0 ? `+${prod.unitsChangePct}%` : `${prod.unitsChangePct}%`}
                            </span>)}
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className="font-bold text-slate-900">DH {prod.revenue.toFixed(2)}</span>
                          {prod.revenueChangePct !== null && timePreset !== 'all' && (<span className={`block text-[10px] ${prod.revenueChangePct >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700'}`}>
                              {prod.revenueChangePct >= 0 ? `+${prod.revenueChangePct}%` : `${prod.revenueChangePct}%`}
                            </span>)}
                        </td>

                        {canViewFinancials && (<td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="font-bold text-emerald-700">DH {prod.profit.toFixed(2)}</span>
                          </td>)}

                        {canViewFinancials && (<td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                              {prod.marginPercent}%
                            </span>
                          </td>)}

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${prod.currentStock === 0
                        ? 'bg-rose-100 text-rose-800'
                        : prod.currentStock <= 2
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'}`}>
                            {prod.currentStock} units
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {prod.stockHealth === 'out_of_stock' ? (<span className="text-[11px] text-rose-700 font-semibold">Out of Stock</span>) : prod.daysOfStock !== null ? (<span className={`text-[11px] font-semibold ${prod.daysOfStock <= 7 ? 'text-amber-700' : 'text-slate-600'}`}>
                              ~{prod.daysOfStock} days left
                            </span>) : (<span className="text-[11px] text-slate-400">Stable</span>)}
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {matchedInv && onOpenRestock ? (<button onClick={() => onOpenRestock(matchedInv)} className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer">
                              Restock
                            </button>) : (<button onClick={() => onNavigateTab('inventory')} className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                              View
                            </button>)}
                        </td>
                      </tr>);
            })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-Based List View (Optimized for Mobile) */}
            <div className="md:hidden mt-3 divide-y divide-slate-100">
              {productPerformance.map((prod) => {
                const matchedInv = inventory.find((i) => i.id === prod.itemId);
                return (<div key={prod.itemId} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">{prod.title}</p>
                        <span className="text-[11px] text-slate-500">{prod.category}</span>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${prod.currentStock === 0
                        ? 'bg-rose-100 text-rose-800'
                        : prod.currentStock <= 2
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'}`}>
                        {prod.currentStock} in stock
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2.5 rounded-xl text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Units Sold</span>
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <span>{prod.unitsSold}</span>
                          {prod.unitsChangePct !== null && timePreset !== 'all' && (<span className={`text-[10px] ${prod.unitsChangePct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {prod.unitsChangePct >= 0 ? `+${prod.unitsChangePct}%` : `${prod.unitsChangePct}%`}
                            </span>)}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">Revenue</span>
                        <span className="font-bold text-slate-900">DH {prod.revenue.toFixed(0)}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">
                          {canViewFinancials ? 'Profit / Margin' : 'Selling Price'}
                        </span>
                        {canViewFinancials ? (<div className="font-bold text-emerald-700 flex items-center gap-1">
                            <span>DH {prod.profit.toFixed(0)}</span>
                            <span className="text-[10px] text-slate-500 font-normal">({prod.marginPercent}%)</span>
                          </div>) : (<span className="font-bold text-slate-900">DH {prod.sellingPrice}</span>)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="text-[11px] text-slate-500">
                        {prod.stockHealth === 'out_of_stock' ? (<span className="text-rose-700 font-semibold">Needs restock immediately</span>) : prod.daysOfStock !== null ? (<span>Velocity: <strong>~{prod.daysOfStock} days</strong> stock left</span>) : (<span>Stable sales velocity</span>)}
                      </div>

                      {matchedInv && onOpenRestock && (<button onClick={() => onOpenRestock(matchedInv)} className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer">
                          Restock
                        </button>)}
                    </div>
                  </div>);
            })}
            </div>
          </>)}
      </div>

      {/* 5. Monthly Revenue Growth & Trend Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Revenue & Margin Trends
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical monthly gross sales and profit trajectory.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block"></span>
              <span className="text-slate-600">Sales</span>
            </div>
            {canViewFinancials && (<div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
                <span className="text-slate-600">Profit</span>
              </div>)}
          </div>
        </div>

        {monthlyData.length === 0 ? (<div className="py-12 text-center text-slate-400">
            <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2"/>
            <p className="text-xs font-medium">No historical sales yet.</p>
          </div>) : (<div className="mt-4">
            <div className="h-56 sm:h-64 flex items-end gap-2 sm:gap-6 pt-4 px-1">
              {monthlyData.map((item, idx) => {
                const prev = idx > 0 ? monthlyData[idx - 1] : null;
                const change = prev && prev.revenue > 0 ? ((item.revenue - prev.revenue) / prev.revenue) * 100 : null;
                const revenueHeightPct = Math.max(12, (item.revenue / maxMonthlyRevenue) * 100);
                const profitHeightPct = Math.max(6, (item.profit / maxMonthlyRevenue) * 100);
                const isSelected = selectedMonth === item.month;
                return (<div key={item.month} onClick={() => setSelectedMonth(isSelected ? null : item.month)} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative">
                    {/* Tooltip on hover/active */}
                    {isSelected && (<div className="absolute -top-16 bg-slate-900 text-white p-2 rounded-lg text-[10px] sm:text-xs shadow-xl z-20 whitespace-nowrap">
                        <p className="font-bold">{item.month}</p>
                        <p>Rev: <strong className="text-blue-300">DH {item.revenue}</strong></p>
                        {canViewFinancials && <p>Profit: <strong className="text-emerald-300">DH {item.profit}</strong></p>}
                      </div>)}

                    {/* Change Indicator */}
                    {change !== null && (<span className={`text-[9px] sm:text-[10px] font-bold mb-1 hidden sm:inline-block ${change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {change >= 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`}
                      </span>)}

                    {/* Bars Container */}
                    <div className="w-full max-w-[44px] flex items-end justify-center gap-1 h-full">
                      <div style={{ height: `${revenueHeightPct}%` }} className={`w-full rounded-t-sm sm:rounded-t-md transition-all ${isSelected ? 'bg-blue-700 ring-2 ring-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}/>
                      {canViewFinancials && (<div style={{ height: `${profitHeightPct}%` }} className={`w-full rounded-t-sm sm:rounded-t-md transition-all ${isSelected ? 'bg-emerald-600 ring-2 ring-emerald-300' : 'bg-emerald-500 hover:bg-emerald-600'}`}/>)}
                    </div>

                    {/* Month Label */}
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-600 mt-2 truncate w-full text-center">
                      {item.month.substring(5)}
                    </span>
                  </div>);
            })}
            </div>
          </div>)}
      </div>

      {/* 6. Breakdown Grid: Category Shares & Fulfillment Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Category Performance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Category Performance</h3>
              <p className="text-xs text-slate-500">Sales distribution across merchandise categories</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{categoryBreakdown.length} active</span>
          </div>

          <div className="mt-4 space-y-3.5">
            {categoryBreakdown.length === 0 ? (<p className="text-xs text-slate-400 py-6 text-center">No category sales in this period</p>) : (categoryBreakdown.slice(0, 5).map((cat) => (<div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{cat.name}</span>
                    <span className="text-slate-600">
                      DH {cat.revenue.toFixed(2)} ({cat.units} sold) • <strong className="text-slate-900">{cat.sharePercent}%</strong>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.max(4, cat.sharePercent)}%` }}/>
                  </div>
                </div>)))}
          </div>
        </div>

        {/* Fulfillment Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Fulfillment Channels</h3>
              <p className="text-xs text-slate-500">Local meetup cash orders vs Facebook shipped orders</p>
            </div>
            <Truck className="w-4 h-4 text-slate-400"/>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Local Pickup</span>
              <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                DH {currentStats.localRevenue.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {currentStats.localOrdersCount} orders (Cash / Venmo / Zelle)
              </p>
            </div>

            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Shipped (Tracking)</span>
              <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                DH {currentStats.shippedRevenue.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {currentStats.shippedOrdersCount} shipped orders
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Shipping Net Profit: <strong className="text-slate-900">DH {currentStats.shippingProfit.toFixed(2)}</strong>
            </span>
            <button onClick={() => onNavigateTab('shipping')} className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer">
              <span>Shipping Hub</span>
              <ChevronRight className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>

      </div>

    </div>);
};
