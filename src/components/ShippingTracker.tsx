import React, { useState, useMemo } from 'react';
import { Truck, Search, Copy, ExternalLink, Check, DollarSign, AlertCircle, Plus, Clock, CheckCircle2, Package, Edit3 } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { saveOrder } from '../services/db';
import { useAuth } from '../context/AuthContext';
interface ShippingTrackerProps {
    orders: Order[];
    onOpenEditOrder: (order: Order) => void;
}
export const ShippingTracker: React.FC<ShippingTrackerProps> = ({ orders, onOpenEditOrder, }) => {
    const { canEditInventory, canViewFinancials } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [carrierFilter, setCarrierFilter] = useState<string>('all');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    // Filter to shipped orders
    const shippedOrders = useMemo(() => {
        return orders.filter((o) => o.fulfillmentType === 'shipping');
    }, [orders]);
    const filteredShipped = useMemo(() => {
        return shippedOrders.filter((o) => {
            const matchesSearch = o.itemTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (o.buyerName && o.buyerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (o.trackingNumber && o.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCarrier = carrierFilter === 'all' || o.carrier === carrierFilter;
            return matchesSearch && matchesCarrier;
        });
    }, [shippedOrders, searchQuery, carrierFilter]);
    // Financial calculations
    const totalCharged = useMemo(() => {
        return shippedOrders.reduce((sum, o) => sum + (o.shippingCharged || 0), 0);
    }, [shippedOrders]);
    const totalCost = useMemo(() => {
        return shippedOrders.reduce((sum, o) => sum + (o.shippingCost || 0), 0);
    }, [shippedOrders]);
    const netShippingProfit = useMemo(() => {
        return Number((totalCharged - totalCost).toFixed(2));
    }, [totalCharged, totalCost]);
    const carriers = useMemo(() => {
        const set = new Set<string>();
        shippedOrders.forEach((o) => {
            if (o.carrier)
                set.add(o.carrier);
        });
        return Array.from(set);
    }, [shippedOrders]);
    const copyTracking = (tracking: string, id: string) => {
        navigator.clipboard.writeText(tracking);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };
    const getCarrierUrl = (carrier: string | undefined, tracking: string | undefined) => {
        if (!tracking)
            return '#';
        const c = (carrier || '').toUpperCase();
        if (c.includes('USPS'))
            return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
        if (c.includes('UPS'))
            return `https://www.ups.com/track?tracknum=${tracking}`;
        if (c.includes('FEDEX'))
            return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
        return `https://www.google.com/search?q=${tracking}`;
    };
    const handleUpdateStatus = async (order: Order, newStatus: OrderStatus) => {
        if (!canEditInventory)
            return;
        try {
            await saveOrder({ ...order, status: newStatus }, order.id);
        }
        catch (err) {
            console.error('Failed to update status', err);
        }
    };
    return (<div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Shipping & Logistics Costs
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              {shippedOrders.length} Shipped Orders
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Compare buyer-paid postage vs actual label costs to track shipping margins and package tracking.
          </p>
        </div>
      </div>

      {/* Shipping Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Collected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Postage Collected From Buyers
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              DH {totalCharged.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Charged via FB Marketplace checkout</p>
        </div>

        {/* Total Paid */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Actual Shipping Label Expenses
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              DH {totalCost.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Paid to USPS, UPS, PirateShip, etc.</p>
        </div>

        {/* Net Shipping Margin */}
        <div className={`p-5 rounded-xl border shadow-xs ${netShippingProfit >= 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
          <span className={`text-xs font-bold uppercase tracking-wider block ${netShippingProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
            Net Shipping Gain / (Loss)
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${netShippingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {netShippingProfit >= 0 ? `+DH ${netShippingProfit.toFixed(2)}` : `-DH ${Math.abs(netShippingProfit).toFixed(2)}`}
            </span>
          </div>
          <p className={`text-xs mt-1 ${netShippingProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netShippingProfit >= 0
            ? '✓ Positive shipping margin boosts your bottom line!'
            : '⚠️ Shipping label costs exceed buyer charges.'}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3"/>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by buyer, title, or tracking #..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-hidden"/>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-700">
            <option value="all">All Carriers</option>
            {carriers.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
      </div>

      {/* Shipping List Table */}
      {filteredShipped.length === 0 ? (<div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
          <h3 className="text-base font-semibold text-slate-800">No shipped orders recorded</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            When recording a sale, select "Shipping" as the fulfillment type to track tracking numbers and label expenses.
          </p>
        </div>) : (<div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Item & Buyer</th>
                  <th className="py-3 px-4">Carrier & Tracking</th>
                  <th className="py-3 px-4">Charged Buyer</th>
                  <th className="py-3 px-4">Actual Label Cost</th>
                  <th className="py-3 px-4">Shipping Margin</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShipped.map((ord) => {
                const charged = ord.shippingCharged || 0;
                const cost = ord.shippingCost || 0;
                const diff = Number((charged - cost).toFixed(2));
                return (<tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{ord.date}</td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 line-clamp-1">{ord.itemTitle}</div>
                        <div className="text-[11px] text-slate-500">{ord.buyerName || 'FB Buyer'}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{ord.carrier || 'USPS'}</span>
                        {ord.trackingNumber ? (<div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {ord.trackingNumber}
                            </span>
                            <button onClick={() => copyTracking(ord.trackingNumber!, ord.id)} title="Copy tracking" className="text-slate-400 hover:text-blue-600 cursor-pointer">
                              {copiedId === ord.id ? (<Check className="w-3.5 h-3.5 text-emerald-600"/>) : (<Copy className="w-3.5 h-3.5"/>)}
                            </button>
                            <a href={getCarrierUrl(ord.carrier, ord.trackingNumber)} target="_blank" rel="noreferrer" title="Track on carrier site" className="text-blue-600 hover:text-blue-800">
                              <ExternalLink className="w-3.5 h-3.5"/>
                            </a>
                          </div>) : (<span className="text-[11px] text-slate-400 block italic">No tracking added</span>)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-900">
                        DH {charged.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600">
                        DH {cost.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`font-bold ${diff >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {diff >= 0 ? `+DH ${diff.toFixed(2)}` : `-DH ${Math.abs(diff).toFixed(2)}`}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <select value={ord.status} onChange={(e) => handleUpdateStatus(ord, e.target.value as OrderStatus)} disabled={!canEditInventory} className="text-[11px] font-bold rounded-md px-2 py-1 border bg-white">
                          <option value="shipped">In Transit (Shipped)</option>
                          <option value="completed">Delivered</option>
                          <option value="pending_pickup">Label Pending</option>
                          <option value="cancelled">Returned</option>
                        </select>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button onClick={() => onOpenEditOrder(ord)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md cursor-pointer">
                          <Edit3 className="w-4 h-4"/>
                        </button>
                      </td>
                    </tr>);
            })}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>);
};
