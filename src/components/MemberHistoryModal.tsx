import React, { useState, useMemo } from 'react';
import { X, History, Award, DollarSign, ShoppingBag, Clock, CheckCircle2, Phone, Mail, Search, Truck, Check, CreditCard, ArrowLeft, Package, ExternalLink, ChevronRight } from 'lucide-react';
import { ConfirmationMember, Order, TeamPayout } from '../types';
interface MemberHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: ConfirmationMember | null;
    orders: Order[];
    payouts?: TeamPayout[];
    onOpenEditOrder: (order: Order) => void;
    onPayMember?: (member: ConfirmationMember, due: number) => void;
}
export const MemberHistoryModal: React.FC<MemberHistoryModalProps> = ({ isOpen, onClose, member, orders, payouts = [], onOpenEditOrder, onPayMember, }) => {
    const [activeTab, setActiveTab] = useState<'orders' | 'payouts'>('orders');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    // Filter orders for this member
    const memberOrders = useMemo(() => {
        if (!member)
            return [];
        return orders.filter((o) => o.confirmationMemberId === member.id);
    }, [orders, member]);
    // Filter payouts for this member
    const memberPayouts = useMemo(() => {
        if (!member)
            return [];
        return payouts.filter((p) => p.memberId === member.id);
    }, [payouts, member]);
    // Aggregate statistics for this member
    const stats = useMemo(() => {
        let totalOrders = memberOrders.length;
        let deliveredOrders = 0;
        let confirmedOrders = 0;
        let cancelledOrders = 0;
        let grantedRewards = 0;
        let pendingRewards = 0;
        let totalUpsellBonus = 0;
        memberOrders.forEach((o) => {
            const reward = o.memberReward || 0;
            const basePr = typeof o.basePrice === 'number' && o.basePrice > 0 ? o.basePrice : o.salePrice;
            const upsellPerUnit = Math.max(0, o.salePrice - basePr);
            const upsellTotal = upsellPerUnit * o.quantity;
            if (o.status === 'delivered' || o.status === 'completed') {
                deliveredOrders++;
            }
            else if (o.status === 'confirmed' || o.status === 'shipped' || o.status === 'pending_pickup') {
                confirmedOrders++;
            }
            else if (o.status === 'cancelled') {
                cancelledOrders++;
            }
            if (o.status !== 'cancelled') {
                totalUpsellBonus += upsellTotal;
                if (o.rewardStatus === 'granted') {
                    grantedRewards += reward;
                }
                else if (o.rewardStatus === 'pending') {
                    pendingRewards += reward;
                }
                else {
                    if (member?.rewardTrigger === 'confirmed') {
                        if (['confirmed', 'delivered', 'completed', 'shipped'].includes(o.status)) {
                            grantedRewards += reward;
                        }
                        else {
                            pendingRewards += reward;
                        }
                    }
                    else {
                        if (['delivered', 'completed'].includes(o.status)) {
                            grantedRewards += reward;
                        }
                        else {
                            pendingRewards += reward;
                        }
                    }
                }
            }
        });
        const totalPaid = member?.totalPaid || 0;
        const unknownSettlement = memberOrders.filter(o => o.legacySettlementUnknown && o.rewardStatus === "granted" && o.status !== "cancelled").reduce((n, o) => n + (o.memberReward || 0), 0);
        const unpaidBalance = Math.max(0, grantedRewards - unknownSettlement - totalPaid);
        return {
            totalOrders,
            unknownSettlement,
            deliveredOrders,
            confirmedOrders,
            cancelledOrders,
            grantedRewards: Number(grantedRewards.toFixed(2)),
            pendingRewards: Number(pendingRewards.toFixed(2)),
            totalUpsellBonus: Number(totalUpsellBonus.toFixed(2)),
            totalPaid: Number(totalPaid.toFixed(2)),
            unpaidBalance: Number(unpaidBalance.toFixed(2)),
        };
    }, [memberOrders, member]);
    // Filtered orders list
    const filteredOrders = useMemo(() => {
        return memberOrders.filter((ord) => {
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'delivered' && (ord.status === 'delivered' || ord.status === 'completed')) ||
                (statusFilter === 'confirmed' && (ord.status === 'confirmed' || ord.status === 'pending_pickup' || ord.status === 'shipped')) ||
                (statusFilter === 'new' && ord.status === 'new') ||
                (statusFilter === 'cancelled' && ord.status === 'cancelled');
            if (!matchesStatus)
                return false;
            if (!searchQuery.trim())
                return true;
            const q = searchQuery.toLowerCase().trim();
            return (ord.buyerName.toLowerCase().includes(q) ||
                ord.itemTitle.toLowerCase().includes(q) ||
                (ord.customerPhone && ord.customerPhone.toLowerCase().includes(q)) ||
                ord.id.toLowerCase().includes(q));
        });
    }, [memberOrders, statusFilter, searchQuery]);
    if (!isOpen || !member)
        return null;
    return (<div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden sm:bg-slate-900/60 sm:backdrop-blur-xs sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="bg-white w-full h-full flex flex-col overflow-hidden sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl sm:shadow-2xl sm:border sm:border-slate-200">
        
        {/* Navigation & Title Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 sm:hidden cursor-pointer" title="Back to team">
              <ArrowLeft className="w-5 h-5"/>
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow-xs shrink-0">
              {member.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg truncate">{member.name}</h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${member.status === 'active'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {member.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Confirmation Team Member Details & History</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onPayMember && (<button onClick={() => onPayMember(member, stats.unpaidBalance)} className="px-3 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer">
                <DollarSign className="w-4 h-4"/>
                <span>Pay {stats.unpaidBalance > 0 ? `(DH ${stats.unpaidBalance.toFixed(2)})` : ''}</span>
              </button>)}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 hidden sm:block cursor-pointer" title="Close modal">
              <X className="w-5 h-5"/>
            </button>
          </div>
        </div>

        {stats.unknownSettlement > 0 && <p className="border-b border-slate-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Imported bonuses of DH {stats.unknownSettlement.toFixed(2)} have no recorded payment status. They remain in history and are excluded from the payable balance.</p>}
        {/* Member Profile Details Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 text-xs">
            {/* Phone */}
            <div className="flex items-center gap-2 text-slate-700 min-w-0">
              <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Phone className="w-3.5 h-3.5"/>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone Number</span>
                {member.phone ? (<a href={`tel:${member.phone}`} className="font-semibold text-blue-600 hover:underline truncate block">
                    {member.phone}
                  </a>) : (<span className="text-slate-400 font-medium">Not provided</span>)}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-2 text-slate-700 min-w-0">
              <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Mail className="w-3.5 h-3.5"/>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Email Address</span>
                {member.email ? (<a href={`mailto:${member.email}`} className="font-semibold text-blue-600 hover:underline truncate block">
                    {member.email}
                  </a>) : (<span className="text-slate-400 font-medium">Not provided</span>)}
              </div>
            </div>

            {/* Reward Rate & Calculation Mode */}
            <div className="flex items-center gap-2 text-slate-700 min-w-0">
              <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Award className="w-3.5 h-3.5"/>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Base Reward & Mode</span>
                <span className="font-bold text-slate-900 block truncate">
                  DH {member.baseReward.toFixed(2)}{' '}
                  <span className={member.rewardCalculationMode === 'per_item' ? 'text-indigo-600' : 'text-slate-600'}>
                    ({member.rewardCalculationMode === 'per_item' ? 'Per Item in Order' : 'Per Order Flat'})
                  </span>
                </span>
              </div>
            </div>

            {/* Trigger Rule */}
            <div className="flex items-center gap-2 text-slate-700 min-w-0">
              <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                {member.rewardTrigger === 'confirmed' ? <CheckCircle2 className="w-3.5 h-3.5"/> : <Truck className="w-3.5 h-3.5"/>}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Release Trigger</span>
                <span className="font-bold text-slate-900 block truncate">
                  {member.rewardTrigger === 'confirmed' ? 'On Confirmed / Shipped' : 'On Delivered'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Financial Stats: Clean flat strip without bulky nested cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-slate-50/80 p-2.5 sm:p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Orders Handled
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg sm:text-2xl font-black font-mono tabular-nums text-slate-900">
                  {stats.totalOrders}
                </span>
                <span className="text-[11px] sm:text-xs font-mono tabular-nums text-emerald-600 font-bold">
                  {stats.deliveredOrders} del.
                </span>
              </div>
            </div>

            <div className="bg-emerald-50/70 p-2.5 sm:p-3.5 rounded-xl border border-emerald-200/80">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Total Earned
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg sm:text-2xl font-black font-mono tabular-nums text-emerald-700">
                  DH {stats.grantedRewards.toFixed(2)}
                </span>
              </div>
              <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                Granted rewards
              </span>
            </div>

            <div className="bg-blue-50/70 p-2.5 sm:p-3.5 rounded-xl border border-blue-200/80">
              <span className="text-[10px] sm:text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                Total Paid
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg sm:text-2xl font-black font-mono tabular-nums text-blue-700">
                  DH {stats.totalPaid.toFixed(2)}
                </span>
              </div>
              <span className="text-[10px] text-blue-600 block mt-0.5 font-medium">
                Recorded payouts
              </span>
            </div>

            <div className={`p-2.5 sm:p-3.5 rounded-xl border ${stats.unpaidBalance > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50/80 border-slate-200/80'}`}>
              <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider block ${stats.unpaidBalance > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
                Balance Due
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-lg sm:text-2xl font-black font-mono tabular-nums ${stats.unpaidBalance > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                  DH {stats.unpaidBalance.toFixed(2)}
                </span>
              </div>
              <span className={`text-[10px] block mt-0.5 font-medium ${stats.unpaidBalance > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {stats.unpaidBalance > 0 ? 'Unsettled balance' : 'Fully settled'}
              </span>
            </div>
          </div>

          {/* Sub Navigation Tabs: Orders vs Payouts */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button onClick={() => setActiveTab('orders')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'orders'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <ShoppingBag className="w-3.5 h-3.5"/>
              <span>Orders ({memberOrders.length})</span>
            </button>
            <button onClick={() => setActiveTab('payouts')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'payouts'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <CreditCard className="w-3.5 h-3.5"/>
              <span>Payouts ({memberPayouts.length})</span>
            </button>
          </div>

          {activeTab === 'orders' ? (<>
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"/>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by buyer, phone, product, or order ID..." className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"/>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {[
                { id: 'all', label: `All (${memberOrders.length})` },
                { id: 'delivered', label: `Delivered (${stats.deliveredOrders})` },
                { id: 'confirmed', label: `Confirmed (${stats.confirmedOrders})` },
                { id: 'new', label: 'New' },
                { id: 'cancelled', label: `Cancelled (${stats.cancelledOrders})` },
            ].map((tab) => (<button key={tab.id} onClick={() => setStatusFilter(tab.id)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${statusFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {tab.label}
                    </button>))}
                </div>
              </div>

              {filteredOrders.length === 0 ? (<div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <History className="w-9 h-9 text-slate-300 mx-auto mb-1.5"/>
                  <p className="text-sm font-semibold text-slate-700">No matching orders found</p>
                  <p className="text-xs text-slate-400 mt-0.5">Try searching with a different keyword or filter</p>
                </div>) : (<>
                  {/* MOBILE VIEW: Clean, modern divided list (no cards inside cards, no cramped sideways tables) */}
                  <div className="block md:hidden divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                    {filteredOrders.map((ord) => {
                    const basePr = typeof ord.basePrice === 'number' && ord.basePrice > 0 ? ord.basePrice : ord.salePrice;
                    const hasUpsell = ord.salePrice > basePr;
                    const upsellDiff = Math.max(0, ord.salePrice - basePr) * ord.quantity;
                    const isGranted = ord.rewardStatus === 'granted' ||
                        (member.rewardTrigger === 'confirmed'
                            ? ['confirmed', 'delivered', 'completed', 'shipped'].includes(ord.status)
                            : ['delivered', 'completed'].includes(ord.status));
                    const isCancelled = ord.status === 'cancelled';
                    return (<div key={ord.id} className="p-3.5 space-y-2 hover:bg-slate-50/60 transition-colors">
                          {/* Row 1: Date & Status */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <span className="font-semibold text-slate-900">{ord.date}</span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-[11px] text-slate-400">#{ord.id.slice(-6)}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border ${ord.status === 'delivered' || ord.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ord.status === 'confirmed' || ord.status === 'shipped'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : ord.status === 'cancelled'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                              {ord.status}
                            </span>
                          </div>

                          {/* Row 2: Product & Buyer */}
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-bold text-slate-900 text-sm leading-snug">
                                {ord.itemTitle}
                              </h3>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-bold shrink-0">
                                Qty: {ord.quantity}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                              <span className="font-medium text-slate-800">{ord.buyerName}</span>
                              {ord.customerPhone && (<>
                                  <span className="text-slate-300">·</span>
                                  <a href={`tel:${ord.customerPhone}`} className="text-blue-600 hover:underline">
                                    {ord.customerPhone}
                                  </a>
                                </>)}
                            </div>
                          </div>

                          {/* Row 3: Financial & Reward Summary */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">DH {ord.salePrice.toFixed(2)}</span>
                                {hasUpsell && (<span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    +DH {upsellDiff.toFixed(2)} upsell
                                  </span>)}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {ord.rewardCalculationMode === 'per_item' ? (<span className="text-indigo-600 font-semibold">Per Item: DH {member.baseReward.toFixed(2)} × {ord.quantity}</span>) : (<span>Per Order: DH {member.baseReward.toFixed(2)}</span>)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className={`font-black text-sm block ${isCancelled ? 'text-slate-400 line-through' : 'text-blue-700'}`}>
                                  DH {(ord.memberReward || 0).toFixed(2)}
                                </span>
                                {isCancelled ? (<span className="text-[10px] font-bold text-rose-600">Cancelled</span>) : isGranted ? (<span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                                    <Check className="w-3 h-3 text-emerald-600"/> Granted
                                  </span>) : (<span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700">
                                    <Clock className="w-3 h-3 text-amber-600"/> Pending
                                  </span>)}
                              </div>

                              <button onClick={() => {
                            onClose();
                            onOpenEditOrder(ord);
                        }} className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold cursor-pointer shrink-0" title="Edit Order">
                                Edit
                              </button>
                            </div>
                          </div>
                        </div>);
                })}
                  </div>

                  {/* DESKTOP VIEW: Full Data Table */}
                  <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                          <tr>
                            <th className="py-3 px-4">Date & Order</th>
                            <th className="py-3 px-4">Product & Buyer</th>
                            <th className="py-3 px-4 text-right">Base vs Sale</th>
                            <th className="py-3 px-4 text-right">Member Reward</th>
                            <th className="py-3 px-4 text-center">Order Status</th>
                            <th className="py-3 px-4 text-center">Reward Status</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredOrders.map((ord) => {
                    const basePr = typeof ord.basePrice === 'number' && ord.basePrice > 0 ? ord.basePrice : ord.salePrice;
                    const hasUpsell = ord.salePrice > basePr;
                    const isGranted = ord.rewardStatus === 'granted' ||
                        (member.rewardTrigger === 'confirmed'
                            ? ['confirmed', 'delivered', 'completed', 'shipped'].includes(ord.status)
                            : ['delivered', 'completed'].includes(ord.status));
                    const isCancelled = ord.status === 'cancelled';
                    return (<tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4">
                                  <span className="font-semibold text-slate-900 block">{ord.date}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">#{ord.id.slice(-6)}</span>
                                </td>

                                <td className="py-3 px-4">
                                  <span className="font-bold text-slate-900 block">{ord.itemTitle}</span>
                                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                                    <span>{ord.buyerName}</span>
                                    {ord.customerPhone && (<span className="text-slate-400">· {ord.customerPhone}</span>)}
                                    <span className="font-semibold text-slate-600">· Qty: {ord.quantity}</span>
                                  </div>
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-slate-900 block">
                                      DH {ord.salePrice.toFixed(2)}
                                    </span>
                                    {hasUpsell ? (<span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                        +DH {(ord.salePrice - basePr).toFixed(2)} upsell
                                      </span>) : (<span className="text-[10px] text-slate-400">
                                        Base: DH {basePr.toFixed(2)}
                                      </span>)}
                                  </div>
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <div className="space-y-0.5">
                                    <span className={`font-black text-sm block ${isCancelled ? 'text-slate-400 line-through' : 'text-blue-700'}`}>
                                      DH {(ord.memberReward || 0).toFixed(2)}
                                    </span>
                                    {!isCancelled && (<span className="text-[10px] text-slate-500 block">
                                        {ord.rewardCalculationMode === 'per_item' ? (<span className="text-indigo-600 font-bold">Per Item (×{ord.quantity})</span>) : (<span>Per Order (flat)</span>)}
                                      </span>)}
                                  </div>
                                </td>

                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize border ${ord.status === 'delivered' || ord.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ord.status === 'confirmed' || ord.status === 'shipped'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : ord.status === 'cancelled'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                    {ord.status}
                                  </span>
                                </td>

                                <td className="py-3 px-4 text-center">
                                  {isCancelled ? (<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                      Cancelled (DH 0)
                                    </span>) : isGranted ? (<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <Check className="w-3 h-3 text-emerald-600"/>
                                      <span>Granted</span>
                                    </span>) : (<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                      <Clock className="w-3 h-3 text-amber-600"/>
                                      <span>Pending</span>
                                    </span>)}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <button onClick={() => {
                            onClose();
                            onOpenEditOrder(ord);
                        }} className="text-xs font-semibold text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded cursor-pointer">
                                    Edit Order
                                  </button>
                                </td>
                              </tr>);
                })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>)}
            </>) : (
        /* Payouts Tab */
        <div className="space-y-3">
              {memberPayouts.length === 0 ? (<div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <CreditCard className="w-9 h-9 text-slate-300 mx-auto mb-1.5"/>
                  <p className="text-sm font-semibold text-slate-700">No payouts recorded yet</p>
                  {onPayMember && (<button onClick={() => onPayMember(member, stats.unpaidBalance)} className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs">
                      Record First Payout
                    </button>)}
                </div>) : (<>
                  {/* Mobile Payouts List */}
                  <div className="block md:hidden divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                    {memberPayouts.map((pay) => (<div key={pay.id} className="p-3.5 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 block">{pay.date}</span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            Method: <span className="font-semibold text-slate-700">{pay.paymentMethod}</span>
                          </span>
                          {pay.notes && (<span className="text-[10px] text-slate-400 block mt-0.5">{pay.notes}</span>)}
                        </div>
                        <span className="font-black text-emerald-700 text-base">
                          DH {pay.amount.toFixed(2)}
                        </span>
                      </div>))}
                  </div>

                  {/* Desktop Payouts Table */}
                  <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4 text-right">Amount</th>
                          <th className="py-3 px-4">Method</th>
                          <th className="py-3 px-4">Notes / Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {memberPayouts.map((pay) => (<tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {pay.date}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                              DH {pay.amount.toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-xs">
                                {pay.paymentMethod}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {pay.notes || '—'}
                            </td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                </>)}
            </div>)}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {activeTab === 'orders' ? `${filteredOrders.length} orders shown` : `${memberPayouts.length} payouts shown`}
          </span>
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>);
};
