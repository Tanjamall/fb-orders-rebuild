import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Users, Search, Plus, Phone, Mail, Award, History, Edit3, Trash2, CheckCircle2, Clock, DollarSign, ShoppingBag, Truck, ChevronRight, X, Layers, Package } from 'lucide-react';
import { ConfirmationMember, Order, TeamPayout } from '../types';
import { useAuth } from '../context/AuthContext';
interface TeamManagerProps {
    teamMembers: ConfirmationMember[];
    orders: Order[];
    payouts?: TeamPayout[];
    onOpenNewMember: (member?: ConfirmationMember) => void;
    onViewHistory: (member: ConfirmationMember) => void;
    onDeleteMember: (memberId: string) => Promise<void>;
    onOpenEditOrder: (order: Order) => void;
    onPayMember: (member: ConfirmationMember, due: number) => void;
}
export const TeamManager: React.FC<TeamManagerProps> = ({ teamMembers, orders, payouts = [], onOpenNewMember, onViewHistory, onDeleteMember, onOpenEditOrder, onPayMember, }) => {
    const { canDeleteRecords, canManageTeam } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const searchInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);
    // Member stats mapping (orders, rewards, paid, due)
    const memberStatsMap = useMemo(() => {
        const map = new Map<string, {
            orderCount: number;
            granted: number;
            unknown: number;
            pending: number;
            upsell: number;
            paid: number;
            due: number;
        }>();
        teamMembers.forEach((m) => {
            map.set(m.id, {
                orderCount: 0,
                granted: 0,
                unknown: 0,
                pending: 0,
                upsell: 0,
                paid: m.totalPaid || 0,
                due: 0,
            });
        });
        orders.forEach((ord) => {
            if (ord.confirmationMemberId && map.has(ord.confirmationMemberId)) {
                const current = map.get(ord.confirmationMemberId)!;
                current.orderCount++;
                if (ord.legacySettlementUnknown && ord.rewardStatus === "granted" && ord.status !== "cancelled")
                    current.unknown += ord.memberReward || 0;
                const reward = ord.memberReward || 0;
                const basePr = typeof ord.basePrice === 'number' && ord.basePrice > 0 ? ord.basePrice : ord.salePrice;
                const upsell = Math.max(0, ord.salePrice - basePr) * ord.quantity;
                if (ord.status !== 'cancelled') {
                    current.upsell += upsell;
                    if (ord.rewardStatus === 'granted') {
                        current.granted += reward;
                    }
                    else if (ord.rewardStatus === 'pending') {
                        current.pending += reward;
                    }
                    else {
                        const trigger = ord.rewardTrigger || 'confirmed';
                        if (trigger === 'delivered') {
                            if (['delivered', 'completed'].includes(ord.status))
                                current.granted += reward;
                            else
                                current.pending += reward;
                        }
                        else {
                            if (['confirmed', 'delivered', 'completed', 'shipped'].includes(ord.status))
                                current.granted += reward;
                            else
                                current.pending += reward;
                        }
                    }
                }
            }
        });
        // Compute due
        teamMembers.forEach((m) => {
            const stats = map.get(m.id);
            if (stats) {
                stats.due = Number(Math.max(0, stats.granted - stats.unknown - stats.paid).toFixed(2));
            }
        });
        return map;
    }, [teamMembers, orders]);
    // Aggregate metrics
    const globalStats = useMemo(() => {
        const totalMembers = teamMembers.length;
        const activeMembers = teamMembers.filter((m) => m.status === 'active').length;
        let totalConfirmedOrders = 0;
        let totalGrantedRewards = 0;
        let totalPendingRewards = 0;
        let totalPaid = 0;
        let totalDue = 0;
        teamMembers.forEach((m) => {
            const s = memberStatsMap.get(m.id);
            if (s) {
                totalConfirmedOrders += s.orderCount;
                totalGrantedRewards += s.granted;
                totalPendingRewards += s.pending;
                totalPaid += s.paid;
                totalDue += s.due;
            }
        });
        return {
            totalMembers,
            activeMembers,
            totalConfirmedOrders,
            totalGrantedRewards: Number(totalGrantedRewards.toFixed(2)),
            totalPendingRewards: Number(totalPendingRewards.toFixed(2)),
            totalPaid: Number(totalPaid.toFixed(2)),
            totalDue: Number(totalDue.toFixed(2)),
        };
    }, [teamMembers, memberStatsMap]);
    // Filtered members list
    const filteredMembers = useMemo(() => {
        return teamMembers.filter((m) => {
            if (statusFilter !== 'all' && m.status !== statusFilter) {
                return false;
            }
            if (!searchQuery.trim())
                return true;
            const q = searchQuery.toLowerCase().trim();
            return (m.name.toLowerCase().includes(q) ||
                (m.phone && m.phone.toLowerCase().includes(q)) ||
                (m.email && m.email.toLowerCase().includes(q)) ||
                (m.notes && m.notes.toLowerCase().includes(q)));
        });
    }, [teamMembers, statusFilter, searchQuery]);
    const handleDelete = async (member: ConfirmationMember) => {
        if (window.confirm(`Delete member "${member.name}"?`)) {
            try {
                await onDeleteMember(member.id);
            }
            catch (err) {
                console.error('Error deleting member', err);
            }
        }
    };
    return (<div className="space-y-4 pb-28">
      {/* Top Header: Title "Team" + Count Badge + Top Search Icon */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 truncate">
            <span>Team</span>
            <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full shrink-0">
              {filteredMembers.length}
            </span>
          </h1>
        </div>

        {/* Top Actions: Search Icon + Status Filter */}
        <div className="flex items-center gap-2 shrink-0">
          {isSearchOpen ? (<div className="flex items-center gap-1.5 bg-white border border-blue-500 rounded-xl px-2.5 py-1.5 shadow-sm text-xs animate-in fade-in duration-150">
              <Search className="w-3.5 h-3.5 text-blue-600 shrink-0"/>
              <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search team..." className="w-28 sm:w-44 bg-transparent text-slate-800 text-xs focus:outline-hidden"/>
              <button onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
            }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>) : (<button onClick={() => setIsSearchOpen(true)} className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl shadow-xs transition-colors cursor-pointer" title="Search">
              <Search className="w-4 h-4"/>
            </button>)}

          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl">
            <button onClick={() => setStatusFilter('all')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${statusFilter === 'all'
            ? 'bg-white text-slate-900 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'}`}>
              All
            </button>
            <button onClick={() => setStatusFilter('active')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${statusFilter === 'active'
            ? 'bg-white text-slate-900 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'}`}>
              Active
            </button>
            <button onClick={() => setStatusFilter('inactive')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${statusFilter === 'inactive'
            ? 'bg-white text-slate-900 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'}`}>
              Inactive
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards: Members, Confirmed Orders, Granted Rewards, Paid, Balance Due */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Members
            </span>
            <Users className="w-4 h-4 text-blue-600"/>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900">
              {globalStats.totalMembers}
            </span>
            <span className="text-xs text-emerald-600 font-bold">
              {globalStats.activeMembers} active
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Orders
            </span>
            <ShoppingBag className="w-4 h-4 text-indigo-600"/>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900">
              {globalStats.totalConfirmedOrders}
            </span>
            <span className="text-xs text-slate-400 font-medium ml-1">confirmed</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Earned
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-700">
              DH {globalStats.totalGrantedRewards.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              Paid
            </span>
            <DollarSign className="w-4 h-4 text-blue-600"/>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-blue-700">
              DH {globalStats.totalPaid.toFixed(2)}
            </span>
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs col-span-2 sm:col-span-1 ${globalStats.totalDue > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200/80'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${globalStats.totalDue > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
              Due
            </span>
            <Clock className={`w-4 h-4 ${globalStats.totalDue > 0 ? 'text-amber-600' : 'text-slate-400'}`}/>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-xl sm:text-2xl font-black font-mono tabular-nums ${globalStats.totalDue > 0 ? 'text-amber-800' : 'text-slate-800'}`}>
              DH {globalStats.totalDue.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {orders.some(o => o.legacySettlementUnknown && !!o.memberReward) && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Imported bonuses are included in earned history. Their payment status was not recorded in the original app, so they are excluded from the payable balance.</p>}
      {/* Team Members List */}
      {filteredMembers.length === 0 ? (<div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
          <h3 className="text-base font-semibold text-slate-800">No members found</h3>
        </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
                const mStats = memberStatsMap.get(member.id) || { orderCount: 0, granted: 0, pending: 0, upsell: 0, paid: 0, due: 0 };
                return (<div key={member.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all group">
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => onViewHistory(member)} className="flex items-center gap-3 text-left group/name cursor-pointer" title="View Member Details & History">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs group-hover/name:scale-105 transition-transform">
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}/>
                      </div>

                      <div>
                        <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5 group-hover/name:text-blue-600 transition-colors">
                          <span>{member.name}</span>
                        </h2>
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          {member.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => onOpenNewMember(member)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer" title="Edit Member">
                        <Edit3 className="w-4 h-4"/>
                      </button>
                      {canDeleteRecords && (<button onClick={() => handleDelete(member)} className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer" title="Delete Member">
                          <Trash2 className="w-4 h-4"/>
                        </button>)}
                    </div>
                  </div>

                  {/* Badges: Rate, Calculation Mode, & Trigger */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg text-xs font-bold">
                      <Award className="w-3.5 h-3.5 text-amber-500"/>
                      <span>DH {member.baseReward.toFixed(2)}<span className="hidden sm:inline"> {member.rewardCalculationMode === 'per_item' ? '/ item' : '/ order'}</span></span>
                    </div>

                    {/* Hidden on mobile to avoid clutter; full calculation details are on member details view */}
                    <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${member.rewardCalculationMode === 'per_item'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'}`} title={member.rewardCalculationMode === 'per_item' ? 'Multiplied by item quantity in order' : 'Flat rate for whole order'}>
                      {member.rewardCalculationMode === 'per_item' ? (<>
                          <Package className="w-3 h-3 text-indigo-600"/>
                          <span>Per Item</span>
                        </>) : (<>
                          <ShoppingBag className="w-3 h-3 text-slate-500"/>
                          <span>Per Order</span>
                        </>)}
                    </div>

                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${member.rewardTrigger === 'confirmed'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                      {member.rewardTrigger === 'confirmed' ? (<>
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600"/>
                          <span>On Confirmed</span>
                        </>) : (<>
                          <Truck className="w-3.5 h-3.5 text-purple-600"/>
                          <span>On Delivered</span>
                        </>)}
                    </div>
                  </div>

                  {/* Contact Info: hidden on mobile cards, displayed on member details page */}
                  {(member.phone || member.email) && (<div className="hidden sm:block mt-2.5 space-y-1 text-xs text-slate-600">
                      {member.phone && (<div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                          <a href={`tel:${member.phone}`} className="hover:text-blue-600 font-medium">
                            {member.phone}
                          </a>
                        </div>)}
                      {member.email && (<div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                          <a href={`mailto:${member.email}`} className="hover:text-blue-600">
                            {member.email}
                          </a>
                        </div>)}
                    </div>)}

                  {/* Financial Stats: Earned | Paid | Due */}
                  <div className="mt-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 grid grid-cols-4 gap-1.5 text-center text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                        Orders
                      </span>
                      <span className="font-black font-mono tabular-nums text-slate-900 text-sm">
                        {mStats.orderCount}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                        Earned
                      </span>
                      <span className="font-black font-mono tabular-nums text-emerald-700 text-sm">
                        DH {mStats.granted.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                        Paid
                      </span>
                      <span className="font-black font-mono tabular-nums text-blue-700 text-sm">
                        DH {mStats.paid.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className={`text-[10px] font-bold uppercase block tracking-wider ${mStats.due > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                        Due
                      </span>
                      <span className={`font-black font-mono tabular-nums text-sm ${mStats.due > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                        DH {mStats.due.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Pay Button & History */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button onClick={() => onPayMember(member, mStats.due)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${mStats.due > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                    <DollarSign className="w-3.5 h-3.5"/>
                    <span>Pay {mStats.due > 0 ? `(DH ${mStats.due.toFixed(2)})` : ''}</span>
                  </button>

                  <button onClick={() => onViewHistory(member)} className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer">
                    <History className="w-3.5 h-3.5"/>
                    <span>History</span>
                    <ChevronRight className="w-3 h-3 text-blue-500"/>
                  </button>
                </div>
              </div>);
            })}
        </div>)}

      {/* Floating Add Button at the bottom */}
      <button onClick={() => onOpenNewMember()} className="fixed bottom-20 md:bottom-8 right-5 md:right-8 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:scale-90 text-white rounded-full shadow-xl shadow-blue-600/40 flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 group focus:outline-hidden focus:ring-4 focus:ring-blue-500/30" title="Add Member" aria-label="Add Member">
        <Plus className="w-7 h-7 transition-transform group-hover:rotate-90 duration-300 stroke-[2.5]"/>
        <span className="sr-only">Add Member</span>
      </button>
    </div>);
};
