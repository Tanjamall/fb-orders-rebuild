import type { DailyDeliveryCost } from "./types";
import {subscribeToDailyCosts} from "./services/db";
import { AuthScreen } from './components/AuthScreen';
import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { testConnection, isDemo } from './supabase';
import { InventoryItem, Order, Vendor, OrderStatus, ConfirmationMember, TeamPayout } from './types';
import { subscribeToInventory, subscribeToOrders, subscribeToVendors, subscribeToTeamMembers, subscribeToTeamPayouts, recordTeamPayout, saveTeamMember, deleteTeamMember, seedDemoData } from './services/db';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { InventoryManager } from './components/InventoryManager';
import { OrdersManager } from './components/OrdersManager';
import { ShippingTracker } from './components/ShippingTracker';
import { VendorManager } from './components/VendorManager';
import { TeamManager } from './components/TeamManager';
import { ProfitTracker } from './components/ProfitTracker';

import { SaleModal } from './components/SaleModal';
import { ItemModal } from './components/ItemModal';
import { BundleModal } from './components/BundleModal';
import { VendorModal } from './components/VendorModal';
import { CSVImporterModal } from './components/CSVImporterModal';
import { SeedDataModal } from './components/SeedDataModal';
import { RestockModal } from './components/RestockModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { TeamMemberModal } from './components/TeamMemberModal';
import { MemberHistoryModal } from './components/MemberHistoryModal';
import { PayoutModal } from './components/PayoutModal';

import { 
  BarChart3, 
  Package, 
  ShoppingBag, 
  Truck, 
  Users, 
  PlusCircle, 
  Sparkles,
  LogIn,
  CheckCircle2,
  Cloud,
  DollarSign,
  MoreHorizontal,
  Building2,
  Upload,
  X
} from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, profile, activeRole, canEditInventory, loading: authLoading, login, workspaceId, authError } = useAuth();
  const [syncError, setSyncError] = useState<string|null>(null);

  const [activeTab, setActiveTab] = useState<string>('orders');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('marketpulse_sidebar_collapsed');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('marketpulse_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [dailyCosts,setDailyCosts]=useState<DailyDeliveryCost[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [teamMembers, setTeamMembers] = useState<ConfirmationMember[]>([]);
  const [teamPayouts, setTeamPayouts] = useState<TeamPayout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [quickSaleItem, setQuickSaleItem] = useState<InventoryItem | null>(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<InventoryItem | null>(null);

  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Confirmation Team Modals State
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ConfirmationMember | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyMember, setHistoryMember] = useState<ConfirmationMember | null>(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutMember, setPayoutMember] = useState<ConfirmationMember | null>(null);
  const [payoutDue, setPayoutDue] = useState<number>(0);

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // Restock & Product Details modal state
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockingItem, setRestockingItem] = useState<InventoryItem | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

  // Initial connection test
  useEffect(() => {
    testConnection();
  }, []);

  // Subscribe only to the isolated local store or an approved Supabase workspace.
  useEffect(() => {
    if (authLoading) {setDailyCosts([]);setInventory([]);setOrders([]);setVendors([]);setTeamMembers([]);setTeamPayouts([]);setLoading(true);return;}

    if (!isDemo && (!user || !workspaceId)) {setDailyCosts([]);setInventory([]);setOrders([]);setVendors([]);setTeamMembers([]);setTeamPayouts([]);setLoading(false);return;}
    setSyncError(null);
    setLoading(true);
    const errors=new Map<string,string>();
    const report=(name:string,error?:Error)=>{if(error)errors.set(name,name+': '+error.message);else errors.delete(name);setSyncError([...errors.values()].join('; ')||null);};
    let invLoaded = false;
    let ordLoaded = false;
    let vndLoaded = false;
    let memLoaded = false;

    const checkDone = () => {
      if (invLoaded && ordLoaded && vndLoaded && memLoaded) {
        setLoading(false);
      }
    };

    setDailyCosts([]);
    const unsubCosts=subscribeToDailyCosts(costs=>{report('Delivery costs');setDailyCosts(costs);},err=>report('Delivery costs',err));
    const unsubInventory = subscribeToInventory(
      (items) => {
        report('Inventory');
        setInventory(items);
        invLoaded = true;
        checkDone();
      },
      (err) => {
        report('Inventory',err);
        invLoaded = true;
        checkDone();
      }
    );

    const unsubOrders = subscribeToOrders(
      (ords) => {
        report('Orders');
        setOrders(ords);
        ordLoaded = true;
        checkDone();
      },
      (err) => {
        report('Orders',err);
        ordLoaded = true;
        checkDone();
      }
    );

    const unsubVendors = subscribeToVendors(
      (vnds) => {
        report('Vendors');
        setVendors(vnds);
        vndLoaded = true;
        checkDone();
      },
      (err) => {
        report('Vendors',err);
        vndLoaded = true;
        checkDone();
      }
    );

    const unsubTeam = subscribeToTeamMembers(
      (mems) => {
        report('Employees');
        setTeamMembers(mems);
        memLoaded = true;
        checkDone();
      },
      (err) => {
        report('Employees',err);
        setTeamMembers([]);
        memLoaded = true;
        checkDone();
      }
    );

    const unsubPayouts = subscribeToTeamPayouts(
      (pays) => {
        report('Payouts');
        setTeamPayouts(pays);
      },
      (err) => {
        report('Payouts',err);
        setTeamPayouts([]);
      }
    );

    return () => {
      unsubCosts();
      unsubInventory();
      unsubOrders();
      unsubVendors();
      unsubTeam();
      unsubPayouts();
    };
  }, [user, authLoading, workspaceId]);

  // Confirmation Team CRUD handlers
  const handleSaveTeamMember = async (memberData: Omit<ConfirmationMember, 'id'>, id?: string) => {
    const savedId = await saveTeamMember(memberData, id);

  };

  const handleDeleteTeamMember = async (memberId: string) => {
    await deleteTeamMember(memberId);
    if (isDemo) {
      setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  };

  const handleOpenPayout = (member: ConfirmationMember, due: number) => {
    setPayoutMember(member);
    setPayoutDue(due);
    setPayoutModalOpen(true);
  };

  const handleRecordPayout = async (payoutData: Omit<TeamPayout, 'id'>) => {
    await recordTeamPayout(payoutData);
  };

  // Low stock count for alerts
  const lowStockCount = useMemo(() => {
    return inventory.filter(
      (item) => item.status !== 'draft' && item.stock <= (item.lowStockThreshold ?? 2)
    ).length;
  }, [inventory]);

  // Handlers
  const handleOpenNewSale = (initialData?: Partial<Order>) => {
    setEditingOrder(initialData ? (initialData as Order) : null);
    setQuickSaleItem(null);
    setSaleModalOpen(true);
  };

  const handleQuickSaleFromItem = (item: InventoryItem) => {
    setEditingOrder(null);
    setQuickSaleItem(item);
    setSaleModalOpen(true);
  };

  const handleOpenNewItem = (initialData?: Partial<InventoryItem>) => {
    setEditingItem(initialData ? (initialData as InventoryItem) : null);
    setItemModalOpen(true);
  };

  const handleOpenNewBundle = (initialData?: Partial<InventoryItem>) => {
    setEditingBundle(initialData ? (initialData as InventoryItem) : null);
    setBundleModalOpen(true);
  };

  const handleBundleSaved = (savedBundle: InventoryItem) => {
    setInventory((prev) => {
      const exists = prev.some((i) => i.id === savedBundle.id);
      return exists
        ? prev.map((i) => (i.id === savedBundle.id ? savedBundle : i))
        : [savedBundle, ...prev];
    });
  };

  const handleOpenNewVendor = (initialData?: Partial<Vendor>) => {
    setEditingVendor(initialData ? (initialData as Vendor) : null);
    setVendorModalOpen(true);
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const isNowDelivered = ['delivered', 'completed'].includes(newStatus);
    const today = new Date().toISOString().slice(0, 10);
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const deliveredDate = isNowDelivered ? (o.deliveredDate || today) : o.deliveredDate;
        return { ...o, status: newStatus, deliveredDate };
      })
    );
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handleOrderSaved = (savedOrder: Order) => {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === savedOrder.id);
      return exists
        ? prev.map((o) => (o.id === savedOrder.id ? savedOrder : o))
        : [savedOrder, ...prev];
    });
  };

  const handleOpenRestock = (item: InventoryItem) => {
    setRestockingItem(item);
    setRestockModalOpen(true);
  };

  const handleOpenProductDetails = (item: InventoryItem) => {
    setDetailItem(item);
    setDetailModalOpen(true);
  };

  const handleItemUpdated = (updatedItem: InventoryItem) => {
    setInventory((prev) =>
      prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
    );
    if (detailItem && detailItem.id === updatedItem.id) {
      setDetailItem(updatedItem);
    }
  };

  if (!isDemo && (authLoading || !workspaceId)) return <AuthScreen />;

  // If authenticated user has completely empty cloud DB

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex font-sans selection:bg-blue-600 selection:text-white">
      {(authError || syncError) && <div role="alert" className="fixed top-16 left-4 right-4 z-50 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">{authError || syncError}</div>}
      {/* Desktop Collapsible Side Panel */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        lowStockCount={lowStockCount}
        onOpenNewSale={() => handleOpenNewSale()}
        onOpenNewItem={() => handleOpenNewItem()}
        onOpenCSVImport={() => setCsvModalOpen(true)}
        onOpenSeedModal={() => setSeedModalOpen(true)}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Streamlined Top Navbar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          lowStockCount={lowStockCount}
          onOpenNewSale={() => handleOpenNewSale()}
          onOpenNewItem={() => handleOpenNewItem()}
          onOpenCSVImport={() => setCsvModalOpen(true)}
          onOpenSeedModal={() => setSeedModalOpen(true)}
        />

        {/* Cloud vs Demo Notice Banner */}
        {isDemo && (
          <div className="bg-slate-900 text-white py-2 px-4 text-xs">
            <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-slate-300">
                  You are currently exploring in <strong>Interactive Demo Mode</strong> with pre-populated marketplace inventory.
                </span>
              </div>
              <button
                onClick={login}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Demo mode</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5">
        
        {/* Tab View Switcher */}
        {activeTab === 'dashboard' && (
          <Dashboard
            dailyCosts={dailyCosts}
            inventory={inventory}
            orders={orders}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenNewSale={() => handleOpenNewSale()}
            onOpenNewItem={() => handleOpenNewItem()}
            onOpenRestock={handleOpenRestock}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryManager
            inventory={inventory}
            vendors={vendors}
            onOpenNewItem={handleOpenNewItem}
            onOpenNewBundle={handleOpenNewBundle}
            onOpenQuickSale={handleQuickSaleFromItem}
            onOpenRestock={handleOpenRestock}
            onOpenProductDetails={handleOpenProductDetails}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersManager
            dailyCosts={dailyCosts}
            orders={orders}
            onOpenNewSale={handleOpenNewSale}
            onOpenCSVImport={() => setCsvModalOpen(true)}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onDeleteOrder={handleDeleteOrder}
          />
        )}

        {activeTab === 'shipping' && (
          <ShippingTracker
            orders={orders}
            onOpenEditOrder={(ord) => handleOpenNewSale(ord)}
          />
        )}

        {activeTab === 'vendors' && (
          <VendorManager
            vendors={vendors}
            inventory={inventory}
            onOpenNewVendor={handleOpenNewVendor}
            onFilterInventoryByVendor={(vId) => {
              setActiveTab('inventory');
            }}
          />
        )}

        {activeTab === 'profit' && (
          <ProfitTracker
            dailyCosts={dailyCosts}
            orders={orders}
            onOpenEditOrder={(ord) => handleOpenNewSale(ord)}
            onNavigateToOrders={() => setActiveTab('orders')}
          />
        )}

        {activeTab === 'team' && (
          <TeamManager
            teamMembers={teamMembers}
            orders={orders}
            payouts={teamPayouts}
            onOpenNewMember={(m) => {
              setEditingMember(m || null);
              setMemberModalOpen(true);
            }}
            onViewHistory={(m) => {
              setHistoryMember(m);
              setHistoryModalOpen(true);
            }}
            onDeleteMember={handleDeleteTeamMember}
            onOpenEditOrder={(ord) => handleOpenNewSale(ord)}
            onPayMember={handleOpenPayout}
          />
        )}
      </main>

      {/* Mobile Floating Bottom Bar for Rapid Single-Thumb Navigation */}
      <div className="md:hidden sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {[
          { id: 'orders', label: 'Orders', icon: ShoppingBag },
          { id: 'profit', label: 'Profit', icon: DollarSign },
          { id: 'inventory', label: 'Inventory', icon: Package, badge: lowStockCount > 0 ? lowStockCount : undefined },
          { id: 'dashboard', label: 'Growth', icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMoreOpen(false);
              }}
              className={`relative flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="absolute top-0 right-1.5 w-4 h-4 text-[9px] font-bold text-white bg-rose-500 rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* More Menu Trigger Button on Mobile Dock */}
        <button
          onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
          className={`relative flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
            ['shipping', 'team', 'vendors'].includes(activeTab) || mobileMoreOpen
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span>More</span>
          {['shipping', 'team', 'vendors'].includes(activeTab) && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
          )}
        </button>
      </div>

      {/* Mobile More Popover Sheet */}
      {mobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs">
          <div 
            className="fixed inset-0" 
            onClick={() => setMobileMoreOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl p-4 shadow-2xl border-t border-slate-200 space-y-2 z-10">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Additional Tools & Settings
              </span>
              <button
                onClick={() => setMobileMoreOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-1 pt-1">
              {[
                { id: 'shipping', label: 'Shipping Tracker', desc: 'Track label costs & carrier rates', icon: Truck },
                { id: 'team', label: 'Confirmation Team', desc: 'Agent rewards & order confirmation history', icon: Users },
                { id: 'vendors', label: 'Vendor Directory', desc: 'Suppliers, restock leads & contacts', icon: Building2 },
              ].map((sub) => {
                const Icon = sub.icon;
                const isSelected = activeTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setActiveTab(sub.id);
                      setMobileMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{sub.label}</div>
                      <div className="text-xs text-slate-400">{sub.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <button
                onClick={() => {
                  setMobileMoreOpen(false);
                  setCsvModalOpen(true);
                }}
                className="flex items-center gap-1.5 font-semibold text-slate-700 p-2 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Import CSV</span>
              </button>
              <button
                onClick={() => {
                  setMobileMoreOpen(false);
                  setSeedModalOpen(true);
                }}
                className="flex items-center gap-1.5 font-semibold text-blue-600 p-2 hover:bg-blue-50 rounded-lg cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Demo Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SaleModal
        isOpen={saleModalOpen}
        onClose={() => {
          setSaleModalOpen(false);
          setEditingOrder(null);
          setQuickSaleItem(null);
        }}
        inventory={inventory}
        teamMembers={teamMembers}
        editingOrder={editingOrder}
        initialItem={quickSaleItem}
        onOrderSaved={handleOrderSaved}
        onItemUpdated={handleItemUpdated}
      />

      <ItemModal
        isOpen={itemModalOpen}
        onClose={() => {
          setItemModalOpen(false);
          setEditingItem(null);
        }}
        vendors={vendors}
        editingItem={editingItem}
      />

      <BundleModal
        isOpen={bundleModalOpen}
        onClose={() => {
          setBundleModalOpen(false);
          setEditingBundle(null);
        }}
        inventory={inventory}
        editingBundle={editingBundle}
        onBundleSaved={handleBundleSaved}
      />

      <VendorModal
        isOpen={vendorModalOpen}
        onClose={() => {
          setVendorModalOpen(false);
          setEditingVendor(null);
        }}
        editingVendor={editingVendor}
      />

      <CSVImporterModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImportComplete={() => {
          setActiveTab('orders');
        }}
      />

      <SeedDataModal
        isOpen={seedModalOpen}
        onClose={() => setSeedModalOpen(false)}
        onSeeded={() => {
          setActiveTab('dashboard');
        }}
      />

      <RestockModal
        isOpen={restockModalOpen}
        onClose={() => {
          setRestockModalOpen(false);
          setRestockingItem(null);
        }}
        item={restockingItem}
        vendors={vendors}
        onItemUpdated={handleItemUpdated}
      />

      <ProductDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailItem(null);
        }}
        item={detailItem}
        orders={orders}
        vendors={vendors}
        onOpenRestock={handleOpenRestock}
        onOpenEdit={handleOpenNewItem}
      />

      <TeamMemberModal
        isOpen={memberModalOpen}
        onClose={() => {
          setMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveTeamMember}
        editingMember={editingMember}
      />

      <MemberHistoryModal
        isOpen={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
          setHistoryMember(null);
        }}
        member={historyMember}
        orders={orders}
        payouts={teamPayouts}
        onOpenEditOrder={(ord) => handleOpenNewSale(ord)}
        onPayMember={handleOpenPayout}
      />

      <PayoutModal
        isOpen={payoutModalOpen}
        onClose={() => {
          setPayoutModalOpen(false);
          setPayoutMember(null);
        }}
        member={payoutMember}
        unpaidBalance={payoutDue}
        totalEarned={
          payoutMember
            ? orders
                .filter(
                  (o) =>
                    o.confirmationMemberId === payoutMember.id && !o.legacySettlementUnknown &&
                    o.status !== 'cancelled' &&
                    (o.rewardStatus === 'granted' ||
                      (payoutMember.rewardTrigger === 'confirmed'
                        ? ['confirmed', 'delivered', 'completed', 'shipped'].includes(o.status)
                        : ['delivered', 'completed'].includes(o.status)))
                )
                .reduce((sum, o) => sum + (o.memberReward || 0), 0)
            : 0
        }
        onSave={handleRecordPayout}
      />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
