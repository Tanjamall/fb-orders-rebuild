import React, { useState } from 'react';
import { 
  ShoppingBag, 
  DollarSign, 
  Package, 
  BarChart3, 
  Truck, 
  Users, 
  Building2, 
  PlusCircle, 
  Upload, 
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  lowStockCount: number;
  onOpenNewSale: () => void;
  onOpenNewItem: () => void;
  onOpenCSVImport: () => void;
  onOpenSeedModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  onToggleCollapse,
  lowStockCount,
  onOpenNewSale,
  onOpenNewItem,
  onOpenCSVImport,
  onOpenSeedModal,
}) => {
  const { canEditInventory, canImportCSV } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  // If collapsed is true, sidebar stays compact until hovered, then smoothly opens
  // If collapsed is false, user has explicitly pinned it open permanently
  const isEffectiveCollapsed = collapsed ? !isHovered : false;

  const mainNavItems = [
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'profit', label: 'Profit', icon: DollarSign },
    { id: 'inventory', label: 'Inventory', icon: Package, badge: lowStockCount > 0 ? lowStockCount : undefined },
    { id: 'dashboard', label: 'Growth', icon: BarChart3 },
  ];

  const operationsNavItems = [
    { id: 'shipping', label: 'Shipping Tracker', icon: Truck },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'vendors', label: 'Vendor Directory', icon: Building2 },
  ];

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`hidden md:flex flex-col shrink-0 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out sticky top-0 h-screen z-30 select-none overflow-x-hidden ${
        isEffectiveCollapsed ? 'w-18' : 'w-64 shadow-xl shadow-slate-900/5'
      }`}
    >
      {/* Top Header: Brand & Collapse Toggle */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-100">
        <button
          onClick={() => setActiveTab('orders')}
          className="flex items-center gap-2.5 text-left group cursor-pointer overflow-hidden focus:outline-hidden"
          title="MarketPulse"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          {!isEffectiveCollapsed && (
            <div className="min-w-0 transition-opacity duration-200 whitespace-nowrap">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-slate-900 tracking-tight">MarketPulse</span>
                <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">FB</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Inventory & Profit</p>
            </div>
          )}
        </button>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors shrink-0"
          title={
            collapsed
              ? isHovered
                ? 'Click to pin sidebar open'
                : 'Hover to open (click to pin open)'
              : 'Pinned open (click to auto-collapse on hover)'
          }
          aria-label={collapsed ? 'Pin side panel open' : 'Auto-collapse side panel on hover'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4 text-blue-600" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6 no-scrollbar">
        {/* Quick Action Button */}
        {canEditInventory && (
          <div>
            {isEffectiveCollapsed ? (
              <button
                onClick={onOpenNewSale}
                title="New Order"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center shadow-sm shadow-blue-500/25 cursor-pointer transition-all hover:scale-105"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={onOpenNewSale}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/25 cursor-pointer transition-all hover:shadow-md whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Order</span>
              </button>
            )}
          </div>
        )}

        {/* Primary Links */}
        <div>
          {!isEffectiveCollapsed && (
            <p className="px-2 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Core Workspace
            </p>
          )}
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={isEffectiveCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isEffectiveCollapsed ? 'justify-center' : 'justify-between'
                  } ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    {!isEffectiveCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {item.badge !== undefined && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold font-mono text-rose-700 bg-rose-50 border border-rose-200 rounded-md">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Operations Links */}
        <div>
          {!isEffectiveCollapsed && (
            <p className="px-2 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Operations
            </p>
          )}
          <div className="space-y-1">
            {operationsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={isEffectiveCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isEffectiveCollapsed ? 'justify-center' : 'justify-start'
                  } ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  {!isEffectiveCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Tools & Utilities */}
        <div className="pt-2 border-t border-slate-100">
          {!isEffectiveCollapsed && (
            <p className="px-2 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Utilities
            </p>
          )}
          <div className="space-y-1">
            {canEditInventory && (
              <button
                onClick={onOpenNewItem}
                title={isEffectiveCollapsed ? '+ Add Item' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap ${
                  isEffectiveCollapsed ? 'justify-center' : 'justify-start'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {!isEffectiveCollapsed && <span>+ Add Item</span>}
              </button>
            )}

            {canImportCSV && (
              <button
                onClick={onOpenCSVImport}
                title={isEffectiveCollapsed ? 'Import CSV' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap ${
                  isEffectiveCollapsed ? 'justify-center' : 'justify-start'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {!isEffectiveCollapsed && <span>Import CSV</span>}
              </button>
            )}

            <button
              onClick={onOpenSeedModal}
              title={isEffectiveCollapsed ? 'Demo Data' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50/60 transition-colors cursor-pointer whitespace-nowrap ${
                isEffectiveCollapsed ? 'justify-center' : 'justify-start'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              {!isEffectiveCollapsed && <span>Demo Data</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Expand/Collapse Bar */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <button
          onClick={onToggleCollapse}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap ${
            isEffectiveCollapsed ? 'justify-center' : 'justify-between'
          }`}
          title={
            collapsed
              ? isHovered
                ? 'Click to pin sidebar open'
                : 'Expands on hover (click to pin open)'
              : 'Pinned open (click to enable auto-collapse on hover)'
          }
        >
          <div className="flex items-center gap-2 min-w-0">
            {collapsed ? <PanelLeftOpen className="w-4 h-4 text-blue-600 shrink-0" /> : <PanelLeftClose className="w-4 h-4 shrink-0" />}
            {!isEffectiveCollapsed && (
              <span className="truncate">
                {collapsed ? 'Pin Sidebar Open' : 'Auto-Collapse on Hover'}
              </span>
            )}
          </div>
          {!isEffectiveCollapsed && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        </button>
      </div>
    </aside>
  );
};
