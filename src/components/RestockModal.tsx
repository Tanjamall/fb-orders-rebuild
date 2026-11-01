import React, { useState, useEffect, useMemo } from 'react';
import { X, PackagePlus, DollarSign, Calendar, Building2, AlertCircle, Layers, TrendingUp, Clock, CheckCircle2, Info } from 'lucide-react';
import { InventoryItem, Vendor } from '../types';
import { appendRestockLot, getItemBatches } from '../services/fifo';
import { restockInventoryItem } from '../services/db';
import { useAuth } from '../context/AuthContext';
interface RestockModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
    vendors: Vendor[];
    onItemUpdated: (updatedItem: InventoryItem) => void;
}
export const RestockModal: React.FC<RestockModalProps> = ({ isOpen, onClose, item, vendors, onItemUpdated, }) => {
    const { user } = useAuth();
    const [variantId, setVariantId] = useState('');
    const [quantity, setQuantity] = useState<number>(5);
    const [costPrice, setCostPrice] = useState<number>(0);
    const [sellingPrice, setSellingPrice] = useState<number>(0);
    const [supplier, setSupplier] = useState<string>('');
    const [receivedDate, setReceivedDate] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    // Sync initial values when modal opens
    useEffect(() => {
        if (item && isOpen) {
            setVariantId(item.variants?.[0]?.id || "");
            setQuantity(5);
            // Pre-fill with item's current cost & selling price as sensible defaults
            setCostPrice(item.costPrice || 0);
            setSellingPrice(item.sellingPrice || 0);
            setSupplier(item.vendorName || '');
            setReceivedDate(new Date().toISOString().slice(0, 10));
            setNotes('');
            setErrorMsg(null);
        }
    }, [item, isOpen]);
    // Existing batches and FIFO preview
    const currentBatches = useMemo(() => {
        return item ? getItemBatches(item) : [];
    }, [item]);
    const activeBatch = useMemo(() => {
        return currentBatches.find((b) => b.remainingQty > 0) || null;
    }, [currentBatches]);
    const fifoSimulation = useMemo(() => {
        if (!item || quantity <= 0)
            return null;
        return appendRestockLot(item, {
            quantity,
            costPrice,
            sellingPrice,
            supplier,
            notes,
            receivedDate,
        });
    }, [item, quantity, costPrice, sellingPrice, supplier, notes, receivedDate]);
    const totalLotCost = useMemo(() => {
        return Number((quantity * costPrice).toFixed(2));
    }, [quantity, costPrice]);
    const projectedLotRevenue = useMemo(() => {
        return Number((quantity * sellingPrice).toFixed(2));
    }, [quantity, sellingPrice]);
    const projectedUnitProfit = useMemo(() => {
        return Number((sellingPrice - costPrice).toFixed(2));
    }, [sellingPrice, costPrice]);
    const projectedMarginPercent = useMemo(() => {
        if (sellingPrice <= 0)
            return 0;
        return Number(((projectedUnitProfit / sellingPrice) * 100).toFixed(1));
    }, [projectedUnitProfit, sellingPrice]);
    if (!isOpen || !item)
        return null;
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (quantity <= 0) {
            setErrorMsg('Please specify a restock quantity of at least 1 unit.');
            return;
        }
        if (costPrice < 0) {
            setErrorMsg('Cost price cannot be negative.');
            return;
        }
        if (sellingPrice < 0) {
            setErrorMsg('Selling price cannot be negative.');
            return;
        }
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            const updated = await restockInventoryItem(item.id, item, {
                quantity: Math.floor(quantity),
                variantId: variantId || undefined,
                costPrice: Number(costPrice),
                sellingPrice: Number(sellingPrice),
                supplier: supplier.trim() || undefined,
                receivedDate: receivedDate || new Date().toISOString().slice(0, 10),
                notes: notes.trim() || undefined,
            });
            onItemUpdated(updated);
            onClose();
        }
        catch (err: any) {
            console.error('Error restocking inventory:', err);
            setErrorMsg(err.message || 'Failed to record restock.');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const nextBatchNumber = currentBatches.length + 1;
    const isPreviousStockEmpty = item.stock === 0;
    return (<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <PackagePlus className="w-5 h-5"/>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-900 truncate">
                Restock Product
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-sm">
                {item.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer" aria-label="Close restock modal">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {errorMsg && (<div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
              <span>{errorMsg}</span>
            </div>)}

          {!!item.variants?.length && <label className="block text-xs font-semibold text-slate-700">Variant<select aria-label="Restock variant" required value={variantId} onChange={e => setVariantId(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 p-2 text-sm">{item.variants.map(v => <option key={v.id} value={v.id}>{v.label} · {v.stock} in stock</option>)}</select></label>}
          {/* FIFO Status Overview Banner */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600"/>
                <span>FIFO Inventory Principle</span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                Incoming Batch #{nextBatchNumber}
              </span>
            </div>
            
            <p className="text-xs text-blue-800/90 leading-relaxed">
              {isPreviousStockEmpty ? (<span>
                  Previous stock is completely sold out (0 units). This new batch of{' '}
                  <strong>{quantity} units</strong> will <strong>activate immediately</strong> at the new prices.
                </span>) : (<span>
                  You currently have <strong>{item.stock} unit{item.stock > 1 ? 's' : ''}</strong> of older stock remaining 
                  at <strong>DH {item.costPrice.toFixed(2)}</strong> cost (selling at <strong>DH {item.sellingPrice.toFixed(2)}</strong>).
                  Per FIFO rules, <strong>those {item.stock} older units will be sold first</strong>. Once they run out, new orders will automatically switch to this new batch price (DH {sellingPrice.toFixed(2)}).
                </span>)}
            </p>

            {activeBatch && !isPreviousStockEmpty && (<div className="text-[11px] text-blue-700/80 pt-1 border-t border-blue-200/60 flex items-center justify-between">
                <span>Currently Active: Batch #{activeBatch.batchNumber}</span>
                <span>{activeBatch.remainingQty} units @ DH {activeBatch.costPrice.toFixed(2)} cost</span>
              </div>)}
          </div>

          {/* Form Inputs Grid */}
          <div className="space-y-3.5">
            {/* Quantity & Received Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Units to Add (Quantity) *
                </label>
                <div className="relative">
                  <input type="number" min="1" step="1" required value={quantity || ''} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="e.g. 5"/>
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                    units
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Received Date
                </label>
                <div className="relative">
                  <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none"/>
                </div>
              </div>
            </div>

            {/* Cost Price & Selling Price for This Batch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Purchase Cost / Unit (DH ) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">DH </span>
                  <input type="number" min="0" step="0.01" required value={costPrice} onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)} className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="0.00"/>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Total lot investment: <strong>DH {totalLotCost.toFixed(2)}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Selling Price / Unit (DH ) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">DH </span>
                  <input type="number" min="0" step="0.01" required value={sellingPrice} onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)} className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="0.00"/>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Est. profit: <strong className={projectedUnitProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    +DH {projectedUnitProfit.toFixed(2)}/unit ({projectedMarginPercent}%)
                  </strong>
                </span>
              </div>
            </div>

            {/* Supplier / Vendor */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supplier / Vendor (Optional)
              </label>
              <div className="relative">
                <input type="text" list="vendor-suggestions" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Select or enter supplier / vendor name..." className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none"/>
                <datalist id="vendor-suggestions">
                  {vendors.map((v) => (<option key={v.id} value={v.name}/>))}
                </datalist>
              </div>
            </div>

            {/* Restock Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Batch Notes & Invoice Ref (Optional)
              </label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Purchased from local clearance, condition verified, receipt #1049..." className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"/>
            </div>
          </div>

          {/* Quick Summary Card */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">New Total Stock:</span>
              <span className="font-extrabold text-slate-900 text-sm">
                {item.stock + quantity} units
              </span>
              <span className="text-[10px] text-slate-400 block">
                ({item.stock} current + {quantity} added)
              </span>
            </div>

            <div className="text-right">
              <span className="text-slate-500 block text-[11px]">Active Selling Price Now:</span>
              <span className="font-extrabold text-blue-700 text-sm">
                DH {(isPreviousStockEmpty ? sellingPrice : item.sellingPrice).toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 block">
                {isPreviousStockEmpty ? 'New batch activates now' : 'Old stock price retained until exhausted'}
              </span>
            </div>
          </div>

        </form>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
            {isSubmitting ? (<span>Saving...</span>) : (<>
                <CheckCircle2 className="w-3.5 h-3.5"/>
                <span>Confirm Restock (+{quantity} Units)</span>
              </>)}
          </button>
        </div>

      </div>
    </div>);
};
