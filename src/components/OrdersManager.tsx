import {MobileOrderCard} from './MobileOrderCard';
import {businessToday} from '../services/backendConfig';
import {matchesOrderPeriod,carryOverLabel} from '../services/orderPeriod';
import {DailyDeliveryEditor} from "./DailyDeliveryEditor";
import {WhatsAppLink} from "./WhatsAppLink";
import { OrderItems } from "./OrderItems";
import type { DailyDeliveryCost } from "../types";
import React, { useState, useMemo, useRef } from 'react';
import { ShoppingBag, Search, Plus, Phone, MapPin, Trash2, Edit3, Check, MoreVertical, TrendingUp, Download, Upload, Copy, ExternalLink, MessageSquareText, Navigation, ChevronDown, X, Award } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { deleteOrder, saveOrder } from '../services/db';
import { useAuth } from '../context/AuthContext';
interface OrdersManagerProps {
    dailyCosts?: DailyDeliveryCost[];
    orders: Order[];
    onOpenNewSale: (initialData?: Partial<Order>) => void;
    onOpenCSVImport: () => void;
    onUpdateOrderStatus?: (orderId: string, newStatus: OrderStatus) => void;
    onDeleteOrder?: (orderId: string) => void;
}
export const OrdersManager: React.FC<OrdersManagerProps> = ({ orders, dailyCosts = [], onOpenNewSale, onOpenCSVImport, onUpdateOrderStatus, onDeleteOrder, }) => {
    const { canEditInventory, canDeleteRecords, canViewFinancials } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [statusFilter, setStatusFilter] = useState<string>('confirmed');
    const [periodFilter, setPeriodFilter] = useState<'this_month' | 'today' | 'last_month' | 'all'>('this_month');
    const [showToolsDropdown, setShowToolsDropdown] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    // Normalize statuses to standard 4: new, confirmed, delivered, cancelled
    const normalizeStatus = (status: string): 'new' | 'confirmed' | 'delivered' | 'cancelled' => {
        if (status === 'completed')
            return 'delivered';
        if (status === 'shipped')
            return 'confirmed';
        if (status === 'pending_pickup')
            return 'confirmed';
        if (status === 'new' || status === 'confirmed' || status === 'delivered' || status === 'cancelled') {
            return status;
        }
        return 'new';
    };
    const statusConfig: Record<'new' | 'confirmed' | 'delivered' | 'cancelled', {
        label: string;
        bg: string;
        text: string;
        border: string;
        activeRing: string;
    }> = {
        new: {
            label: 'New',
            bg: 'bg-blue-50 text-blue-700',
            text: 'text-blue-700',
            border: 'border-blue-200',
            activeRing: 'ring-2 ring-blue-500 bg-blue-600 text-white shadow-xs',
        },
        confirmed: {
            label: 'Confirmed',
            bg: 'bg-amber-50 text-amber-700',
            text: 'text-amber-700',
            border: 'border-amber-200',
            activeRing: 'ring-2 ring-amber-500 bg-amber-600 text-white shadow-xs',
        },
        delivered: {
            label: 'Delivered',
            bg: 'bg-emerald-50 text-emerald-700',
            text: 'text-emerald-700',
            border: 'border-emerald-200',
            activeRing: 'ring-2 ring-emerald-500 bg-emerald-600 text-white shadow-xs',
        },
        cancelled: {
            label: 'Cancelled',
            bg: 'bg-rose-50 text-rose-700',
            text: 'text-rose-700',
            border: 'border-rose-200',
            activeRing: 'ring-2 ring-rose-500 bg-rose-600 text-white shadow-xs',
        },
    };
    // Date strings for period filtering
    const todayStr=businessToday();
    const thisMonthStr=todayStr.slice(0,7);
    const lastMonthStr=useMemo(()=>{const d=new Date(thisMonthStr+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);},[thisMonthStr]);
    // Profit date logic: For delivered orders, attribution date is the date it was delivered
    const getEffectiveDate = (ord: Order): string => {
        const norm = normalizeStatus(ord.status);
        if (norm === 'delivered') {
            return ord.deliveredDate || ord.date || (ord.createdAt ? ord.createdAt.substring(0, 10) : '');
        }
        return ord.date || (ord.createdAt ? ord.createdAt.substring(0, 10) : '');
    };
    // Orders filtered by the selected period (defaults to 'this_month')
    const periodFilteredOrders=useMemo(()=>orders.filter(order=>matchesOrderPeriod(order,periodFilter,todayStr)),[orders,periodFilter,todayStr]);
    // Status Counts within the selected period
    const counts = useMemo(() => {
        const c = { all: periodFilteredOrders.length, new: 0, confirmed: 0, delivered: 0, cancelled: 0 };
        periodFilteredOrders.forEach((o) => {
            const s = normalizeStatus(o.status);
            c[s] = (c[s] || 0) + 1;
        });
        return c;
    }, [periodFilteredOrders]);
    // Filtered Orders (Period + Status + Search)
    const filteredOrders = useMemo(() => {
        return periodFilteredOrders.filter((ord) => {
            const currentNorm = normalizeStatus(ord.status);
            const matchesStatus = statusFilter === 'all' || currentNorm === statusFilter;
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q ||
                ord.buyerName.toLowerCase().includes(q) ||
                (ord.customerPhone && ord.customerPhone.toLowerCase().includes(q)) ||
                (ord.customerAddress && ord.customerAddress.toLowerCase().includes(q)) ||
                ord.itemTitle.toLowerCase().includes(q) ||
                (ord.notes && ord.notes.toLowerCase().includes(q));
            return matchesStatus && matchesSearch;
        }).sort((a, b) => {
            // Delivery day and timestamp determine delivered chronology.
            const dayOrder = getEffectiveDate(b).localeCompare(getEffectiveDate(a));
            if (dayOrder)
                return dayOrder;
            const deliveredTime=statusFilter==='delivered'?(Date.parse(b.deliveredAt||'')||0)-(Date.parse(a.deliveredAt||'')||0):0;
            if(deliveredTime)return deliveredTime;
            const createdOrder = (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0);
            return createdOrder || b.id.localeCompare(a.id);
        });
    }, [periodFilteredOrders, searchQuery, statusFilter]);
    // Realized delivered orders in the selected period (independent of statusFilter or search)
    const realizedPeriodOrders = useMemo(() => {
        return periodFilteredOrders.filter((o) => normalizeStatus(o.status) === 'delivered');
    }, [periodFilteredOrders]);
    const periodCosts = dailyCosts.filter(c => periodFilter === 'all' || (periodFilter === 'today' ? c.date === todayStr : periodFilter === 'this_month' ? c.date.startsWith(thisMonthStr) : c.date.startsWith(lastMonthStr)));
    const sharedDelivery = periodCosts.reduce((n, c) => n + c.amount, 0);
    // Financial summary: Shows the realized financial data of the selected time frame,
    // completely unaffected by status tab selection or search query.
    const summary = useMemo(() => {
        const totalRev = realizedPeriodOrders.reduce((sum, o) => sum + (o.totalRevenue || 0), 0);
        const totalCost = realizedPeriodOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
        const totalProfit = realizedPeriodOrders.reduce((sum, o) => sum + (o.netProfit || 0), 0) - sharedDelivery;
        const avgMargin = totalRev > 0 ? ((totalProfit / totalRev) * 100).toFixed(1) : '0';
        return {
            totalRev,
            totalCost,
            totalProfit,
            avgMargin,
            realizedCount: realizedPeriodOrders.length,
            totalCount: periodFilteredOrders.length,
            count: periodFilteredOrders.length,
        };
    }, [realizedPeriodOrders, periodFilteredOrders, sharedDelivery]);
    const handleQuickStatusChange = async (order: Order, newStatus: OrderStatus) => {
        if (!canEditInventory)
            return;
        try {
            setActionError(null);
            let rewardStatus = order.rewardStatus;
            if (order.confirmationMemberId && order.rewardTrigger) {
                if (newStatus === 'cancelled') {
                    rewardStatus = 'cancelled';
                }
                else if (order.rewardTrigger === 'confirmed') {
                    rewardStatus = ['confirmed', 'delivered', 'shipped', 'completed', 'pending_pickup'].includes(newStatus)
                        ? 'granted'
                        : 'pending';
                }
                else if (order.rewardTrigger === 'delivered') {
                    rewardStatus = ['delivered', 'completed'].includes(newStatus)
                        ? 'granted'
                        : 'pending';
                }
            }
            // Record delivered date when transitioned to delivered for profit attribution
            const isNowDelivered = ['delivered', 'completed'].includes(newStatus);
            const deliveredDate = isNowDelivered
                ? (order.deliveredDate || businessToday())
                : order.deliveredDate;
            await saveOrder({ ...order, status: newStatus, rewardStatus, deliveredDate }, order.id);
            onUpdateOrderStatus?.(order.id, newStatus);
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Unable to change order status.');
        }
    };
    const handleDelete = async (order: Order) => {
        if (!canDeleteRecords)
            return;
        if (window.confirm(`Delete order for "${order.buyerName || order.itemTitle}"?`)) {
            try {
                await deleteOrder(order.id);
                onDeleteOrder?.(order.id);
            }
            catch (err) {
                console.error('Error deleting order', err);
            }
        }
    };
    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };
    const exportToCSV = () => {
        if (filteredOrders.length === 0)
            return;
        const headers = [
            'Date',
            'Customer Name',
            'Phone Number',
            'Address',
            'Google Maps URL',
            'Product Name',
            'Quantity',
            'Sale Price',
            'Total Revenue',
            'Net Profit',
            'Status',
            'Payment Method',
            'Notes',
        ];
        const rows = filteredOrders.map((o) => [
            `"${o.date}"`,
            `"${(o.buyerName || '').replace(/"/g, '""')}"`,
            `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
            `"${(o.customerAddress || '').replace(/"/g, '""')}"`,
            `"${(o.googleMapsUrl || '').replace(/"/g, '""')}"`,
            `"${o.itemTitle.replace(/"/g, '""')}"`,
            o.quantity,
            o.salePrice,
            o.totalRevenue,
            o.netProfit,
            normalizeStatus(o.status),
            o.paymentMethod,
            `"${(o.notes || '').replace(/"/g, '""')}"`,
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `marketplace_orders_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowToolsDropdown(false);
    };
    return (<div className="space-y-3 pb-28">
      
      {/* Top Header: Orders Count + [Search Icon] + [3-Dots Menu] in line */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 truncate">
            <span>Orders</span>
            <span className="text-xs font-bold font-mono tabular-nums bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded-md shrink-0">
              {filteredOrders.length}
            </span>
          </h1>
        </div>

        {/* Action Icons in Line: Search Icon + 3-Dots Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Shrunk Search: Icon-only toggling inline search input */}
          {isSearchOpen ? (<div className="flex items-center gap-1.5 bg-white border border-blue-500 rounded-xl px-2.5 py-1.5 shadow-sm text-xs animate-in fade-in duration-150">
              <Search className="w-3.5 h-3.5 text-blue-600 shrink-0"/>
              <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search orders..." className="w-28 sm:w-44 bg-transparent text-slate-800 text-xs focus:outline-hidden"/>
              {searchQuery && (<button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer" title="Clear search">
                  <X className="w-3 h-3"/>
                </button>)}
              <button onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
            }} className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer ml-0.5 border-l border-slate-200 pl-1" title="Close search">
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>) : (<button onClick={() => {
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }} className={`p-2 rounded-xl border transition-colors cursor-pointer shadow-xs flex items-center justify-center ${searchQuery
                ? 'bg-blue-50 border-blue-400 text-blue-600'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'}`} title={searchQuery ? `Searching: "${searchQuery}" (Click to view)` : "Search orders"} aria-label="Search orders">
              <Search className="w-4 h-4"/>
              {searchQuery && (<span className="w-1.5 h-1.5 bg-blue-600 rounded-full ml-1"/>)}
            </button>)}

          <DailyDeliveryEditor costs={dailyCosts}/>

          {/* More Tools 3-Dots Dropdown */}
          <div className="relative">
            <button onClick={() => setShowToolsDropdown(!showToolsDropdown)} className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shadow-xs" title="Order tools & history export">
              <MoreVertical className="w-4 h-4 text-slate-600"/>
            </button>

            {showToolsDropdown && (<div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in slide-in-from-top-1 text-xs">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Order Tools
                </div>
                <button onClick={exportToCSV} className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium">
                  <Download className="w-3.5 h-3.5 text-slate-500"/>
                  <span>Export Orders CSV</span>
                </button>
                <button onClick={() => {
                onOpenCSVImport();
                setShowToolsDropdown(false);
            }} className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium">
                  <Upload className="w-3.5 h-3.5 text-blue-600"/>
                  <span>Import Orders CSV</span>
                </button>
              </div>)}
          </div>
        </div>
      </div>

      {actionError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}<button className="ml-3 underline" onClick={() => setActionError(null)}>Dismiss</button></div>}

      {/* Always-Visible Financial Summary with Default "This Month" */}
      {canViewFinancials && (<div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="hidden md:flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <TrendingUp className="w-4 h-4"/>
              </span>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Financial Summary
                </h2>
                <span className="text-[11px] text-slate-400 font-medium">
                  {periodFilter === 'this_month' && 'This Month (Realized)'}
                  {periodFilter === 'today' && 'Today (Realized)'}
                  {periodFilter === 'last_month' && 'Last Month (Realized)'}
                  {periodFilter === 'all' && 'All-Time (Realized)'}
                </span>
              </div>
            </div>

            {/* Period Selector Tabs: "This Month" by default */}
            <div className="inline-flex items-center bg-slate-800/90 p-1 rounded-xl gap-1 shrink-0 self-start sm:self-auto">
              {[
                { id: 'this_month', label: 'This Month' },
                { id: 'today', label: 'Today' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'all', label: 'All' },
            ].map((p) => {
                const active = periodFilter === p.id;
                return (<button key={p.id} onClick={() => setPeriodFilter(p.id as any)} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${active
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'}`}>
                    {p.label}
                  </button>);
            })}
            </div>
          </div>

          {/* Key Metric Tiles: Constant across status tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/50">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Realized Revenue</span>
              <span className="text-base sm:text-lg font-black font-mono tabular-nums text-blue-300">DH {summary.totalRev.toFixed(2)}</span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/50">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Realized Profit</span>
              <span className="text-base sm:text-lg font-black font-mono tabular-nums text-emerald-400">+DH {summary.totalProfit.toFixed(2)}</span>
            </div>
            <div className="hidden md:block bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/50">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Realized Margin</span>
              <span className="text-base sm:text-lg font-black font-mono tabular-nums text-emerald-300">{summary.avgMargin}%</span>
            </div>
            <div className="hidden md:block bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/50">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Delivered Orders</span>
              <span className="text-base sm:text-lg font-black font-mono tabular-nums text-slate-200">
                {summary.realizedCount} <span className="text-xs text-slate-400 font-normal">/ {summary.totalCount} total</span>
              </span>
            </div>
          </div>
        </div>)}

      {/* 4 Status Tabs: New, Confirmed, Delivered, Cancelled */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'new', label: 'New', count: counts.new },
            { id: 'confirmed', label: 'Confirmed', count: counts.confirmed },
            { id: 'delivered', label: 'Delivered', count: counts.delivered },
            { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
        ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (<button key={tab.id} onClick={() => setStatusFilter(tab.id)} className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <span>{tab.label}</span>
              <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-md font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {tab.count}
              </span>
            </button>);
        })}
      </div>

      {/* Active Search Query Indicator (if search closed but query entered) */}
      {searchQuery && !isSearchOpen && (<div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-xs text-blue-900 animate-in fade-in">
          <span className="truncate">
            Filtering by: <span className="font-bold">"{searchQuery}"</span>
          </span>
          <button onClick={() => setSearchQuery('')} className="text-blue-600 hover:text-blue-800 font-bold ml-2 cursor-pointer shrink-0">
            Clear
          </button>
        </div>)}

      {/* Orders Grid: Mobile-First Compact Card, Multi-Column Desktop Adaptation (NO STRETCHING) */}
      {filteredOrders.length === 0 ? (<div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 shadow-xs">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2"/>
          <h3 className="text-sm font-bold text-slate-800">No orders found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {searchQuery ? 'No orders match your search query.' : 'Tap "+ New Order" to record a new sale.'}
          </p>
          {canEditInventory && (<button onClick={() => onOpenNewSale()} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer">
              + Create Order
            </button>)}
        </div>) : (<>
          {/* Desktop Table View (Optimized for Wide Aspect Ratio Displays) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 whitespace-nowrap">Date & Order</th>
                    <th className="py-3 px-4">Customer & Delivery</th>
                    <th className="py-3 px-4">Product Details</th>
                    {canViewFinancials && (<th className="py-3 px-4 text-right whitespace-nowrap">Net Profit</th>)}
                    <th className="py-3 px-4 whitespace-nowrap">Confirmation Agent</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((ord) => {
                const currentStatus = normalizeStatus(ord.status);
                const cfg = statusConfig[currentStatus];
                const mapsLink = ord.googleMapsUrl || (ord.customerAddress ? `https://maps.google.com/?q=${encodeURIComponent(ord.customerAddress)}` : null);
                return (<tr key={ord.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => onOpenNewSale(ord)}>
                        {/* Status Dropdown */}
                        <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-flex items-center">
                            <select value={currentStatus} onChange={(e) => handleQuickStatusChange(ord, e.target.value as OrderStatus)} disabled={!canEditInventory} aria-label="Order status" className={`text-xs font-bold py-1.5 pl-2.5 pr-6 rounded-lg border cursor-pointer appearance-none transition-colors ${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-95 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed`}>
                              <option value="new" className="text-slate-900 bg-white font-medium">New</option>
                              <option value="confirmed" className="text-slate-900 bg-white font-medium">Confirmed</option>
                              <option value="delivered" className="text-slate-900 bg-white font-medium">Delivered</option>
                              <option value="cancelled" className="text-slate-900 bg-white font-medium">Cancelled</option>
                            </select>
                            <ChevronDown className={`w-3.5 h-3.5 absolute right-1.5 pointer-events-none ${cfg.text}`}/>
                          </div>
                        </td>

                        {/* Date & Attribution */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {currentStatus === 'delivered' ? (<div>
                              <div className="font-bold text-emerald-700 flex items-center gap-1">
                                <span>{ord.deliveredDate || ord.date}</span>
                                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">Delivered</span>
                              </div>
                              {ord.deliveredDate && ord.deliveredDate !== ord.date && (<div className="text-[10px] text-slate-400 mt-0.5">Ordered: {ord.date}</div>)}
                            </div>) : (<div>
                              <div className="font-semibold text-slate-800">{ord.date}</div>
                              {periodFilter==='this_month'&&carryOverLabel(ord,thisMonthStr)&&<span className="mt-1 inline-flex w-fit rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{carryOverLabel(ord,thisMonthStr)}</span>}
                              {ord.paymentMethod && (<div className="text-[10px] text-slate-400 capitalize">{ord.paymentMethod}</div>)}
                            </div>)}
                        </td>

                        {/* Customer & Address */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{ord.buyerName || 'Facebook Customer'}</div>
                          {ord.customerPhone && (<div className="text-[11px] text-blue-600 flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                              <Phone className="w-3 h-3 text-blue-500 shrink-0"/>
                              <a href={`tel:${ord.customerPhone}`} className="hover:underline font-medium">
                                {ord.customerPhone}
                              </a>
                              <WhatsAppLink phone={ord.customerPhone}/>
                            </div>)}
                          {ord.customerAddress && (<div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1 max-w-sm truncate" onClick={(e) => e.stopPropagation()}>
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0"/>
                              <span className="truncate" title={ord.customerAddress}>{ord.customerAddress}</span>
                              <button onClick={() => copyToClipboard(ord.customerAddress!, ord.id)} title="Copy address" className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer shrink-0">
                                {copiedId === ord.id ? (<Check className="w-3 h-3 text-emerald-600"/>) : (<Copy className="w-3 h-3"/>)}
                              </button>
                              {mapsLink && (<a href={mapsLink} target="_blank" rel="noreferrer" title="Open on Google Maps" className="text-blue-600 hover:text-blue-800 p-0.5 shrink-0">
                                  <ExternalLink className="w-3 h-3"/>
                                </a>)}
                            </div>)}
                        </td>

                        {/* Product & Qty */}
                        <td className="py-3 px-4"><OrderItems order={ord}/>
                          {ord.notes && (<div className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 flex items-center gap-1 max-w-xs truncate" title={ord.notes}>
                              <MessageSquareText className="w-3 h-3 shrink-0 text-amber-600"/>
                              <span className="truncate">{ord.notes}</span>
                            </div>)}
                        </td>

                        {/* Financials: Net Profit only (Revenue, Cost, and Margin removed per desktop layout) */}
                        {canViewFinancials && (<td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="font-black font-mono tabular-nums text-emerald-700 text-sm">
                              +DH {ord.netProfit.toFixed(2)}
                            </span>
                          </td>)}

                        {/* Confirmation Agent */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {ord.confirmationMemberName ? (<div>
                              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-blue-600"/>
                                <span>{ord.confirmationMemberName}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="font-bold font-mono tabular-nums text-blue-700">+DH {(ord.memberReward || 0).toFixed(2)}</span>
                                {ord.rewardCalculationMode === 'per_item' && ord.quantity > 1 && (<span className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 rounded-md">
                                    Per Item (×{ord.quantity})
                                  </span>)}
                                <span className={`px-1.5 py-0.2 rounded-md font-bold uppercase text-[9px] border ${ord.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : ord.rewardStatus === 'granted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                  {ord.status === 'cancelled' ? 'Void' : ord.legacySettlementUnknown ? 'Recorded bonus' : ord.rewardStatus === 'granted' ? 'Earned' : 'Pending'}
                                </span>
                              </div>
                            </div>) : (<span className="text-slate-400 text-[11px]">&mdash;</span>)}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {canEditInventory && (<button onClick={() => onOpenNewSale(ord)} title="Edit order" className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                                <Edit3 className="w-4 h-4"/>
                              </button>)}
                            {canDeleteRecords && (<button onClick={() => handleDelete(ord)} title="Delete order" className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors">
                                <Trash2 className="w-4 h-4"/>
                              </button>)}
                          </div>
                        </td>
                      </tr>);
            })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards use the approved compact layout; desktop table stays unchanged. */}
          <div className="md:hidden grid grid-cols-1 gap-2.5">
            {filteredOrders.map(order=><MobileOrderCard key={order.id} order={order} status={normalizeStatus(order.status)} carryOver={periodFilter==='this_month'?carryOverLabel(order,thisMonthStr):null} canEdit={canEditInventory} canDelete={canDeleteRecords} canViewFinancials={canViewFinancials} copied={copiedId===order.id} onCopy={copyToClipboard} onEdit={onOpenNewSale} onDelete={handleDelete} onStatusChange={handleQuickStatusChange}/>)}
          </div>
      </>)}

      {/* Floating "New Order" Action Button: High contrast, thumb-reachable at bottom */}
      {canEditInventory && (<button onClick={() => onOpenNewSale()} className="fixed bottom-20 md:bottom-8 right-5 md:right-8 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:scale-90 text-white rounded-full shadow-xl shadow-blue-600/40 flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 group focus:outline-hidden focus:ring-4 focus:ring-blue-500/30" title="New Order" aria-label="New Order">
          <Plus className="w-7 h-7 transition-transform group-hover:rotate-90 duration-300 stroke-[2.5]"/>
          <span className="sr-only">New Order</span>
        </button>)}
    </div>);
};
