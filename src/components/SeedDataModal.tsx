import React, { useState } from 'react';
import { X, Sparkles, Check, AlertCircle, ShoppingBag, Package, TrendingUp } from 'lucide-react';
import { seedDemoData } from '../services/db';

interface SeedDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSeeded: () => void;
}

export const SeedDataModal: React.FC<SeedDataModalProps> = ({
  isOpen,
  onClose,
  onSeeded,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSeed = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await seedDemoData();
      onSeeded();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error seeding sample data');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-blue-50/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-base">Load Sample Marketplace Data</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-slate-600">
          <p>
            Quickly populate realistic Facebook Marketplace records to test charts, profit calculations, and stock alerts:
          </p>

          <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2.5 text-slate-800">
              <Package className="w-4 h-4 text-blue-600" />
              <span><strong>6 Catalog Items</strong>: iPhone 14 Pro, Herman Miller Aeron, PS5 Slim, Dyson V12, MCM Credenza, AirPods Pro</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-800">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span><strong>7 Past Sales</strong>: Over multiple months with cash meetups, FB Pay, USPS tracking & net profit margins</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-800">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span><strong>3 Verified Suppliers</strong>: Wholesale electronics, overstock liquidators, and estate consignment contacts</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSeed}
              disabled={loading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Populating...' : 'Load Realistic Data'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
