import type { DailyDeliveryCost } from "../types";
import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Calendar, ShoppingBag, ArrowUpRight, Download, Search, CheckCircle2, Phone, MapPin, ChevronRight, Filter, Percent, Clock, Layers, Sparkles } from 'lucide-react';
import { Order, OrderStatus } from '../types';
interface ProfitTrackerProps {
    dailyCosts?: DailyDeliveryCost[];
    orders: Order[];
    onOpenEditOrder: (order: Order) => void;
    onNavigateToOrders: () => void;
}
type PeriodFilter = 'today' | 'this_month' | 'last_month' | 'custom';
export const ProfitTracker: React.FC<ProfitTrackerProps> = ({ orders, dailyCosts = [], onOpenEditOrder, onNavigateToOrders, }) => {
    const [period, setPeriod] = useState<PeriodFilter>('this_month');
    const [searchQuery, setSearchQuery] = useState('');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    // Normalize order status to match 4 standard statuses
    const isDelivered = (status: OrderStatus | string) => {
        return status === 'delivered' || status === 'completed';
    };
    // Helper date strings
    const todayStr = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, []);
    const thisMonthStr = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }, []);
    const lastMonthStr = useMemo(() => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }, []);
    // Filter delivered orders by selected period based on delivery date (profit date)
    const deliveredOrdersInPeriod = useMemo(() => {
        return orders.filter((ord) => {
            if (!isDelivered(ord.status))
                return false;
            // Realized profit belongs to the date the order was delivered (fallback to date/createdAt if not recorded)
            const profitDate = ord.deliveredDate || ord.date || (ord.createdAt ? ord.createdAt.substring(0, 10) : '');
            if (!profitDate)
                return false;
            if (period === 'today') {
                return profitDate === todayStr;
            }
            if (period === 'this_month') {
                return profitDate.startsWith(thisMonthStr);
            }
            if (period === 'last_month') {
                return profitDate.startsWith(lastMonthStr);
            }
            if (period === 'custom') {
                if (customStart && profitDate < customStart)
                    return false;
                if (customEnd && profitDate > customEnd)
                    return false;
                return true;
            }
            return true;
        });
    }, [orders, period, todayStr, thisMonthStr, lastMonthStr, customStart, customEnd]);
    // Search filtered orders
    const filteredDeliveredOrders = useMemo(() => {
        if (!searchQuery.trim())
            return deliveredOrdersInPeriod;
        const q = searchQuery.toLowerCase().trim();
        return deliveredOrdersInPeriod.filter((o) => o.buyerName.toLowerCase().includes(q) ||
            o.itemTitle.toLowerCase().includes(q) ||
            (o.customerPhone && o.customerPhone.toLowerCase().includes(q)) ||
            (o.customerAddress && o.customerAddress.toLowerCase().includes(q)) ||
            o.id.toLowerCase().includes(q));
    }, [deliveredOrdersInPeriod, searchQuery]);
    const periodCosts = dailyCosts.filter(c => period === 'today' ? c.date === todayStr : period === 'this_month' ? c.date.startsWith(thisMonthStr) : period === 'last_month' ? c.date.startsWith(lastMonthStr) : (!customStart || c.date >= customStart) && (!customEnd || c.date <= customEnd));
    const sharedDelivery = periodCosts.reduce((n, c) => n + c.amount, 0);
    // Aggregate Key Stats for this period
    const stats = useMemo(() => {
        const totalOrdersCount = deliveredOrdersInPeriod.length;
        let totalRevenue = 0;
        let totalCost = 0;
        let totalNetProfit = 0;
        let totalUnits = 0;
        let totalTeamRewards = 0;
        deliveredOrdersInPeriod.forEach((o) => {
            totalRevenue += o.totalRevenue || 0;
            totalCost += o.totalCost || 0;
            totalNetProfit += o.netProfit || 0;
            totalUnits += o.quantity || 1;
            totalTeamRewards += o.memberReward || 0;
        });
        totalNetProfit -= sharedDelivery;
        totalCost += sharedDelivery;
        const marginPercent = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
        const avgProfitPerOrder = totalOrdersCount > 0 ? totalNetProfit / totalOrdersCount : 0;
        return {
            totalOrdersCount,
            totalRevenue,
            totalCost,
            totalNetProfit,
            totalUnits,
            totalTeamRewards: Number(totalTeamRewards.toFixed(2)),
            marginPercent: Number(marginPercent.toFixed(1)),
            avgProfitPerOrder: Number(avgProfitPerOrder.toFixed(2)),
        };
    }, [deliveredOrdersInPeriod, sharedDelivery]);
    // Export CSV of delivered orders for this period
    const handleExportCSV = () => {
        if (deliveredOrdersInPeriod.length === 0 && !periodCosts.length)
            return;
        const headers = [
            'Order ID',
            'Delivered Date (Profit Date)',
            'Order Created Date',
            'Buyer Name',
            'Phone',
            'Address',
            'Item',
            'Quantity',
            'Sale Price',
            'Total Revenue',
            'Total Cost',
            'Net Profit',
            'Margin %'
        ];
        const rows = deliveredOrdersInPeriod.map((o) => [
            o.id,
            o.deliveredDate || o.date,
            o.date,
            `"${o.buyerName.replace(/"/g, '""')}"`,
            `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
            `"${(o.customerAddress || '').replace(/"/g, '""')}"`,
            `"${o.itemTitle.replace(/"/g, '""')}"`,
            o.quantity,
            o.salePrice,
            o.totalRevenue,
            o.totalCost,
            o.netProfit,
            o.profitMargin || 0
        ]);
        periodCosts.forEach(c => rows.push([c.id, c.date, c.date, "", "", "", "Shared delivery cost", 0, 0, 0, c.amount, -c.amount, 0]));
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `marketplace-delivered-profit-${period}-${new Date().toISOString().substring(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    const getPeriodLabel = () => {
        if (period === 'today')
            return 'Today';
        if (period === 'this_month')
            return 'This Month';
        if (period === 'last_month')
            return 'Last Month';
        return customStart || customEnd ? `${customStart || 'Start'} to ${customEnd || 'Now'}` : 'Custom Period';
    };
    return (<div className="space-y-4 pb-20 md:pb-12">
      
      {/* Top Header & Date Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <DollarSign className="w-5 h-5"/>
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Profit
            </h1>
          </div>

          {/* Period Filter Buttons - strictly single line */}
          <div className="grid grid-cols-4 sm:flex sm:items-center gap-1 bg-slate-100/90 p-1 rounded-xl">
            {(['today', 'this_month', 'last_month', 'custom'] as PeriodFilter[]).map((p) => {
            const labels: Record<PeriodFilter, string> = {
                today: 'Today',
                this_month: 'This Month',
                last_month: 'Last Month',
                custom: 'Custom'
            };
            const active = period === p;
            return (<button key={p} onClick={() => setPeriod(p)} className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap text-center transition-all cursor-pointer ${active
                    ? 'bg-white text-emerald-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`}>
                  {labels[p]}
                </button>);
        })}
          </div>
        </div>

        {/* Custom Date Inputs if Custom selected */}
        {period === 'custom' && (<div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="font-medium text-slate-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400"/>
              Date Range:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-white"/>
              <span className="text-slate-400">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-white"/>
              {(customStart || customEnd) && (<button onClick={() => {
                    setCustomStart('');
                    setCustomEnd('');
                }} className="text-slate-500 hover:text-slate-700 underline text-xs cursor-pointer ml-1">
                  Clear
                </button>)}
            </div>
          </div>)}
      </div>


      {/* Basic Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Profit Card */}
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-4 sm:p-5 shadow-sm shadow-emerald-700/20">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-100">
              Net Profit ({getPeriodLabel()})
            </span>
            <div className="p-1.5 rounded-lg bg-white/15 text-white">
              <TrendingUp className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-tight">
              DH {stats.totalNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-100 font-medium">
            <span className="px-1.5 py-0.5 rounded-md bg-white/20 font-bold font-mono tabular-nums">
              {stats.marginPercent}%
            </span>
            <span>realized profit margin</span>
          </div>
        </div>

        {/* Delivered Revenue */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
              Delivered Revenue
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <DollarSign className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 tracking-tight">
            DH {stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Cost of items: <span className="font-semibold font-mono tabular-nums text-slate-700">DH {stats.totalCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Delivered Orders */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
              Delivered Orders
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <CheckCircle2 className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 tracking-tight">
            {stats.totalOrdersCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Total units sold: <span className="font-semibold font-mono tabular-nums text-slate-700">{stats.totalUnits} items</span>
          </div>
        </div>

        {/* Avg Profit per Order */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
              Avg Profit / Order
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Percent className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 tracking-tight">
            DH {stats.avgProfitPerOrder.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {stats.totalOrdersCount} delivered customer{stats.totalOrdersCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {periodCosts.length > 0 && <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold text-slate-700">Shared delivery costs · DH {sharedDelivery.toFixed(2)}</summary><div className="mt-3 space-y-2">{periodCosts.map(c => <div key={c.id} className="flex justify-between text-slate-600"><span>{c.date}</span><span>DH {c.amount.toFixed(2)}</span></div>)}</div></details>}
      {/* Delivered Orders List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Delivered Orders ({deliveredOrdersInPeriod.length})
            </h2>
            <span className="text-xs text-slate-500">
              for {getPeriodLabel()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"/>
              <input type="text" placeholder="Search buyer, item, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-emerald-500"/>
            </div>

            {/* CSV Export */}
            {deliveredOrdersInPeriod.length > 0 && (<button onClick={handleExportCSV} title="Download CSV for this period" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors">
                <Download className="w-3.5 h-3.5"/>
                <span className="hidden sm:inline">Export CSV</span>
              </button>)}
          </div>
        </div>

        {/* Content list or empty state */}
        {filteredDeliveredOrders.length === 0 ? (<div className="p-8 sm:p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <ShoppingBag className="w-6 h-6"/>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              No delivered orders found for {getPeriodLabel()}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Orders marked as "Delivered" in this date range will automatically appear here with their net profit and margins.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {period !== 'this_month' && (<button onClick={() => setPeriod('this_month')} className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer">
                  View This Month
                </button>)}
              <button onClick={onNavigateToOrders} className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg cursor-pointer">
                Go to Orders Tab
              </button>
            </div>
          </div>) : (<div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Profit Date (Delivered)</th>
                    <th className="py-3 px-4">Customer & Contact</th>
                    <th className="py-3 px-4">Item & Qty</th>
                    <th className="py-3 px-4 text-right">Revenue</th>
                    <th className="py-3 px-4 text-right">Cost</th>
                    <th className="py-3 px-4 text-right">Net Profit</th>
                    <th className="py-3 px-4 text-center">Margin</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeliveredOrders.map((ord) => (<tr key={ord.id} className="hover:bg-slate-50/80 transition-colors cursor-pointer group" onClick={() => onOpenEditOrder(ord)}>
                      <td className="py-3 px-4 whitespace-nowrap font-medium">
                        <div className="font-bold text-slate-900">{ord.deliveredDate || ord.date}</div>
                        {ord.deliveredDate && ord.deliveredDate !== ord.date && (<div className="text-[10px] text-slate-400">Created: {ord.date}</div>)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{ord.buyerName}</div>
                        {ord.customerPhone && (<div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400"/>
                            <span>{ord.customerPhone}</span>
                          </div>)}
                        {ord.customerAddress && (<div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {ord.customerAddress}
                          </div>)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 line-clamp-1">{ord.itemTitle}</div>
                        <div className="text-[11px] text-slate-500">
                          Qty: <span className="font-bold text-slate-700">{ord.quantity}</span> &times; DH {ord.salePrice.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                        DH {ord.totalRevenue.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                        DH {ord.totalCost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-extrabold text-emerald-700 text-sm">
                          +DH {ord.netProfit.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ord.profitMargin?.toFixed(1) || 0}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditOrder(ord);
                }} className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded font-semibold text-xs transition-colors cursor-pointer">
                          Details
                        </button>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>

            {/* Mobile Compact Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredDeliveredOrders.map((ord) => (<div key={ord.id} onClick={() => onOpenEditOrder(ord)} className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{ord.buyerName}</div>
                      <div className="text-xs text-slate-600 font-medium line-clamp-1 mt-0.5">
                        {ord.itemTitle}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-emerald-700">
                        +DH {ord.netProfit.toFixed(2)}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {ord.profitMargin?.toFixed(1) || 0}% margin
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">Qty: {ord.quantity}</span>
                      <span>&bull;</span>
                      <span>Total: DH {ord.totalRevenue.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span className="font-semibold text-emerald-800">Delivered: {ord.deliveredDate || ord.date}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400"/>
                    </div>
                  </div>
                </div>))}
            </div>
          </div>)}

      </div>

    </div>);
};
