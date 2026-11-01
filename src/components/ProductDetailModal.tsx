import { InventoryAudit } from "./InventoryAudit";
import { InventoryVariants } from "./OrderItems";
import { productOrderLines } from "../services/orderLines";
import React, { useState, useMemo } from 'react';
import { X, Package, Layers, History, ShoppingBag, ExternalLink, Calendar, Building2, DollarSign, TrendingUp, Tag, Clock, CheckCircle2, AlertTriangle, Edit3, PackagePlus, Truck, MapPin, FileText, Boxes } from 'lucide-react';
import { InventoryItem, Order, Vendor } from '../types';
import { getItemBatches } from '../services/fifo';
import { useAuth } from '../context/AuthContext';
interface ProductDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
    orders: Order[];
    vendors: Vendor[];
    onOpenRestock: (item: InventoryItem) => void;
    onOpenEdit: (item: InventoryItem) => void;
}
export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ isOpen, onClose, item, orders, vendors, onOpenRestock, onOpenEdit, }) => {
    const { canEditInventory, canViewFinancials } = useAuth();
    const [activeTab, setActiveTab] = useState<'batches' | 'history' | 'sales'>('batches');
    const batches = useMemo(() => {
        return item ? getItemBatches(item) : [];
    }, [item]);
    const activeBatch = useMemo(() => {
        return batches.find((b) => b.remainingQty > 0) || null;
    }, [batches]);
    // Product sales history
    const itemOrders = useMemo(() => {
        if (!item)
            return [];
        const map = new Map<string, Order>();
        for (const o of productOrderLines(orders).filter(o => o.itemId === item.id)) {
            const before = map.get(o.id);
            if (before) {
                before.quantity += o.quantity;
                before.totalRevenue += o.totalRevenue;
                before.netProfit += o.netProfit;
                before.items = [...(before.items || []), ...(o.items || [])];
                before.salePrice = before.totalRevenue / before.quantity;
            }
            else
                map.set(o.id, { ...o, items: [...(o.items || [])] });
        }
        return [...map.values()];
    }, [item, orders]);
    // Financial aggregates for this specific product
    const productStats = useMemo(() => {
        if (!item) {
            return {
                totalInventoryCost: 0,
                totalInventoryRetail: 0,
                totalUnitsSold: 0,
                totalRevenue: 0,
                totalProfit: 0,
                totalCostSpent: 0,
            };
        }
        const totalInventoryCost = batches.reduce((sum, b) => sum + (b.remainingQty || 0) * (b.costPrice || 0), 0);
        const totalInventoryRetail = batches.reduce((sum, b) => sum + (b.remainingQty || 0) * item.sellingPrice, 0);
        const activeOrders = itemOrders.filter((o) => ['delivered', 'completed'].includes(o.status));
        const totalUnitsSold = activeOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
        const totalRevenue = activeOrders.reduce((sum, o) => sum + (o.totalRevenue || 0), 0);
        const totalProfit = activeOrders.reduce((sum, o) => sum + (o.netProfit || 0), 0);
        const totalCostSpent = batches.reduce((sum, b) => sum + (b.initialQty || 0) * (b.costPrice || 0), 0);
        return {
            totalInventoryCost,
            totalInventoryRetail,
            totalUnitsSold,
            totalRevenue,
            totalProfit,
            totalCostSpent,
        };
    }, [item, batches, itemOrders]);
    if (!isOpen || !item)
        return null;
    const isLowStock = item.stock <= (item.lowStockThreshold ?? 2) && item.stock > 0;
    const isOutOfStock = item.stock === 0 || item.status === 'out_of_stock';
    const unitMargin = item.sellingPrice - item.costPrice;
    const marginPercent = item.sellingPrice > 0 ? Math.round((unitMargin / item.sellingPrice) * 100) : 0;
    return (<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header with Clean Action Buttons Layout */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Title & Badges */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                {item.sku && (<span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200/80 text-slate-800">
                    SKU: {item.sku}
                  </span>)}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {item.category || 'General'}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 uppercase">
                  {item.condition?.replace('_', ' ')}
                </span>
                {item.fulfillmentType && (<span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <Truck className="w-2.5 h-2.5"/>
                    {item.fulfillmentType === 'local' ? 'Local Pickup' : item.fulfillmentType === 'shipping' ? 'Shipping' : 'Pickup & Shipping'}
                  </span>)}
                {item.isBundle && (<span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 flex items-center gap-1">
                    <Layers className="w-2.5 h-2.5"/>
                    BUNDLE
                  </span>)}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOutOfStock
            ? 'bg-rose-100 text-rose-800'
            : isLowStock
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'}`}>
                  {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'Active In-Stock'}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug truncate">
                {item.title}
              </h2>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                {item.vendorName && (<span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400"/>
                    <span>Vendor: <strong>{item.vendorName}</strong></span>
                  </span>)}
                {item.listingUrl && (<a href={item.listingUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-semibold">
                    <ExternalLink className="w-3 h-3"/>
                    <span>FB Listing</span>
                  </a>)}
              </div>
            </div>

            {/* Clean Action Buttons Group (No Record Sale button) */}
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              {canEditInventory && (<>
                  <button onClick={() => {
                onClose();
                onOpenRestock(item);
            }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs" title="Restock this product (FIFO)">
                    <PackagePlus className="w-3.5 h-3.5"/>
                    <span>Restock</span>
                  </button>

                  <button onClick={() => {
                onClose();
                onOpenEdit(item);
            }} className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer" title="Edit Product Details">
                    <Edit3 className="w-3.5 h-3.5 text-slate-500"/>
                    <span>Edit</span>
                  </button>
                </>)}

              <div className="h-5 w-px bg-slate-200 mx-0.5 hidden sm:block"/>

              <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer" aria-label="Close product detail modal">
                <X className="w-4 h-4"/>
              </button>
            </div>

          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('batches')} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'batches'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-100'}`}>
            <Layers className="w-3.5 h-3.5"/>
            <span>FIFO Batches ({batches.length})</span>
          </button>

          <button onClick={() => setActiveTab('history')} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'history'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-100'}`}>
            <History className="w-3.5 h-3.5"/>
            <span>Restock Timeline ({batches.length})</span>
          </button>

          <button onClick={() => setActiveTab('sales')} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'sales'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-100'}`}>
            <ShoppingBag className="w-3.5 h-3.5"/>
            <span>Orders History ({itemOrders.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Key Financial & Inventory Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Metric 1: Stock */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Current Stock
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-slate-900">{item.stock}</span>
                <span className="text-xs text-slate-500 font-semibold">units</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                Alert threshold: {item.lowStockThreshold ?? 2} units
              </span>
            </div>

            {/* Metric 2: Active Selling Price (FIFO) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Active Price (FIFO)
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-blue-700">DH {item.sellingPrice.toFixed(2)}</span>
              </div>
              <span className="text-[10px] text-blue-600/90 font-semibold block mt-0.5 truncate">
                {activeBatch ? `Lot #${activeBatch.batchNumber} (${activeBatch.remainingQty} left)` : 'Exhausted'}
              </span>
            </div>

            {/* Metric 3: Active Cost Basis & Margin */}
            {canViewFinancials && (<div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Unit Cost Basis
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-700">DH {item.costPrice.toFixed(2)}</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-bold block mt-0.5 truncate">
                  +DH {unitMargin.toFixed(2)} ({marginPercent}%)
                </span>
              </div>)}

            {/* Metric 4: Inventory Valuation */}
            {canViewFinancials && (<div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Stock Asset Value
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-900">DH {productStats.totalInventoryCost.toFixed(2)}</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                  Retail val: DH {productStats.totalInventoryRetail.toFixed(2)}
                </span>
              </div>)}
          </div>

          {/* Bundle Information (if bundle) */}
          {item.isBundle && item.bundleItems && item.bundleItems.length > 0 && (<div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 space-y-1.5">
              <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-indigo-600"/>
                <span>Bundle Contents:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {item.bundleItems.map((bi, idx) => (<div key={idx} className="bg-white/80 rounded-lg p-2 border border-indigo-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{bi.quantity}x {bi.itemTitle}</span>
                    {canViewFinancials && bi.unitCost && (<span className="text-slate-400 text-[11px]">DH {bi.unitCost.toFixed(2)} cost</span>)}
                  </div>))}
              </div>
            </div>)}

          {/* Product Notes (if present) */}
          {item.notes && (<div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5"/>
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">Product Notes:</span>
                <p className="text-slate-600 leading-relaxed">{item.notes}</p>
              </div>
            </div>)}

          {/* TAB 1: FIFO Batches */}
          <InventoryVariants item={item}/>
          {activeTab === 'batches' && (<div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  FIFO Queue Order (Oldest Stock Sells First)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Orders automatically sell units from Batch #1 first at its purchase cost and selling price.
                  Once older stock is depleted, sales automatically switch to the next batch in queue.
                </p>
              </div>

              {batches.length === 0 ? (<div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  No stock batches recorded yet. Restock this item to create Batch #1.
                </div>) : (<div className="space-y-2.5">
                  {batches.map((batch, idx) => {
                    const isBatchActive = batch.remainingQty > 0 && activeBatch?.id === batch.id;
                    const isQueued = batch.remainingQty > 0 && activeBatch?.id !== batch.id;
                    const isDepleted = batch.remainingQty === 0;
                    const soldUnits = batch.initialQty - batch.remainingQty;
                    const progressPercent = batch.initialQty > 0 ? (soldUnits / batch.initialQty) * 100 : 0;
                    return (<div key={batch.id || idx} className={`rounded-xl border p-3.5 transition-all ${isBatchActive
                            ? 'bg-blue-50/40 border-blue-300 shadow-xs ring-2 ring-blue-500/10'
                            : isQueued
                                ? 'bg-white border-slate-200'
                                : 'bg-slate-50/60 border-slate-200 opacity-60'}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-extrabold text-[11px] flex items-center justify-center">
                              #{batch.batchNumber || idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">
                                  Batch #{batch.batchNumber || idx + 1}
                                </span>
                                {isBatchActive && (<span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[10px] uppercase flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"/>
                                    Selling Now
                                  </span>)}
                                {isQueued && (<span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5"/>
                                    In Queue
                                  </span>)}
                                {isDepleted && (<span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                                    Exhausted
                                  </span>)}
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Received on {batch.receivedDate}
                                {batch.supplier ? ` • Supplier: ${batch.supplier}` : ''}
                              </span>
                            </div>
                          </div>

                          {/* Remaining / Total Stock */}
                          <div className="text-right">
                            <span className="text-xs font-black text-slate-900 block">
                              {batch.remainingQty} / {batch.initialQty} left
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {soldUnits} units sold
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden mb-2.5">
                          <div className={`h-full rounded-full transition-all duration-300 ${isDepleted ? 'bg-slate-400' : isBatchActive ? 'bg-blue-600' : 'bg-amber-500'}`} style={{ width: `${progressPercent}%` }}/>
                        </div>

                        {/* Pricing details for this batch */}
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100/80 flex-wrap gap-2">
                          <div className="flex items-center gap-4">
                            {canViewFinancials && (<div>
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Cost Price</span>
                                <span className="font-semibold text-slate-700">DH {batch.costPrice.toFixed(2)}</span>
                              </div>)}
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Selling Price</span>
                              <span className="font-bold text-slate-900">DH {batch.sellingPriceKnown===false?"—":batch.sellingPrice.toFixed(2)}</span>
                            </div>
                            {canViewFinancials && (<div>
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Margin</span>
                                <span className="font-semibold text-emerald-600">
                                  {batch.sellingPriceKnown===false?'—':'+DH '+(batch.sellingPrice - batch.costPrice).toFixed(2)}
                                </span>
                              </div>)}
                          </div>

                          {batch.notes && (<span className="text-[11px] text-slate-500 italic max-w-xs truncate">
                              "{batch.notes}"
                            </span>)}
                        </div>
                      </div>);
                })}
                </div>)}
            </div>)}

          {/* TAB 2: Restock History Timeline */}
          {activeTab === 'history' && (<div className="space-y-3">{canViewFinancials && <InventoryAudit productId={item.id}/>}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Restock Event Log Over Time
                </h3>
                <p className="text-[11px] text-slate-400">
                  Complete audit trail of every inventory delivery and restock lot added for this item.
                </p>
              </div>

              {batches.length === 0 ? (<div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  No restock events recorded yet.
                </div>) : (<div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400">
                      <tr>
                        <th className="px-3.5 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Batch</th>
                        <th className="px-3 py-2.5">Qty Added</th>
                        {canViewFinancials && <th className="px-3 py-2.5">Unit Cost</th>}
                        <th className="px-3 py-2.5">Target Price</th>
                        {canViewFinancials && <th className="px-3 py-2.5">Total Outlay</th>}
                        <th className="px-3.5 py-2.5">Supplier & Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...batches].reverse().map((b, i) => (<tr key={b.id || i} className="hover:bg-slate-50/60">
                          <td className="px-3.5 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                            {b.receivedDate}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                            #{b.batchNumber || batches.length - i}
                          </td>
                          <td className="px-3 py-2.5 font-black text-blue-700 whitespace-nowrap">
                            +{b.initialQty}
                          </td>
                          {canViewFinancials && (<td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                              DH {b.costPrice.toFixed(2)}
                            </td>)}
                          <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                            DH {b.sellingPriceKnown===false?"—":b.sellingPrice.toFixed(2)}
                          </td>
                          {canViewFinancials && (<td className="px-3 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                              DH {((b.initialQty || 0) * (b.costPrice || 0)).toFixed(2)}
                            </td>)}
                          <td className="px-3.5 py-2.5 text-slate-500">
                            <span className="font-medium text-slate-700">{b.supplier || '—'}</span>
                            {b.notes ? <span className="text-[10px] text-slate-400 block italic truncate max-w-xs">{b.notes}</span> : null}
                          </td>
                        </tr>))}
                    </tbody>
                  </table>
                </div>)}
            </div>)}

          {/* TAB 3: Sales Orders for this item */}
          {activeTab === 'sales' && (<div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Sales History for this Product
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    All Facebook Marketplace customer orders fulfilled using this product's inventory.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-emerald-600">
                    +DH {productStats.totalProfit.toFixed(2)} Profit
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {productStats.totalUnitsSold} units sold
                  </span>
                </div>
              </div>

              {itemOrders.length === 0 ? (<div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  No sales recorded for this product yet.
                </div>) : (<div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400">
                      <tr>
                        <th className="px-3.5 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Customer</th>
                        <th className="px-3 py-2.5">Qty</th>
                        <th className="px-3 py-2.5">Sold Price</th>
                        {canViewFinancials && <th className="px-3 py-2.5">Cost Basis</th>}
                        {canViewFinancials && <th className="px-3 py-2.5">Net Profit</th>}
                        <th className="px-3.5 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemOrders.map((o) => (<tr key={o.id} className="hover:bg-slate-50/60">
                          <td className="px-3.5 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                            {o.date}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-900 truncate max-w-[120px]">
                            {o.buyerName}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-700">
                            {o.quantity}
                          </td>
                          <td className="px-3 py-2.5 font-black text-slate-900 whitespace-nowrap">
                            DH {o.salePrice.toFixed(2)}
                          </td>
                          {canViewFinancials && (<td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                              DH {o.unitCost.toFixed(2)}
                            </td>)}
                          {canViewFinancials && (<td className="px-3 py-2.5 font-black text-emerald-600 whitespace-nowrap">
                              +DH {o.netProfit.toFixed(2)}
                            </td>)}
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${o.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                        o.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            o.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                                'bg-amber-100 text-amber-800'}`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>))}
                    </tbody>
                  </table>
                </div>)}
            </div>)}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-slate-400 text-[11px] hidden sm:block">
            Created: {item.createdAt?.slice(0, 10)} • Last Updated: {item.updatedAt?.slice(0, 10)}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer">
              Close
            </button>
            {canEditInventory && (<>
                <button onClick={() => {
                onClose();
                onOpenEdit(item);
            }} className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer">
                  <Edit3 className="w-3.5 h-3.5 text-slate-500"/>
                  <span>Edit</span>
                </button>
                <button onClick={() => {
                onClose();
                onOpenRestock(item);
            }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs">
                  <PackagePlus className="w-3.5 h-3.5"/>
                  <span>Restock</span>
                </button>
              </>)}
          </div>
        </div>

      </div>
    </div>);
};
