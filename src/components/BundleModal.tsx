import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Layers, Plus, Trash2, AlertCircle, Sparkles, Check, Package } from 'lucide-react';
import { InventoryItem, BundleItemRef, ItemCondition, ItemStatus } from '../types';
import { saveInventoryItem } from '../services/db';
import { useAuth } from '../context/AuthContext';
interface BundleModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventory: InventoryItem[];
    editingBundle?: InventoryItem | null;
    onBundleSaved?: (savedItem: InventoryItem) => void;
}
export const BundleModal: React.FC<BundleModalProps> = ({ isOpen, onClose, inventory, editingBundle, onBundleSaved, }) => {
    const { user, profile } = useAuth();
    const [title, setTitle] = useState('');
    const [sku, setSku] = useState('');
    const [category, setCategory] = useState('Bundles');
    const [condition, setCondition] = useState<ItemCondition>('new');
    const [notes, setNotes] = useState('');
    // Selected bundle constituent items
    const [bundleItems, setBundleItems] = useState<BundleItemRef[]>([]);
    // Item to add picker state
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [itemQuantityToAdd, setItemQuantityToAdd] = useState<number>(1);
    // Pricing & Stock
    const [customCostPrice, setCustomCostPrice] = useState<number | null>(null);
    const [sellingPrice, setSellingPrice] = useState<number>(0);
    const [stock, setStock] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    // Available individual products (exclude other bundles and archived items)
    const availableProducts = useMemo(() => {
        return inventory.filter((item) => !item.isBundle && item.status !== 'archived');
    }, [inventory]);
    // Compute calculated cost and suggested retail price
    const calculatedCost = useMemo(() => {
        return bundleItems.reduce((sum, item) => sum + (item.unitCost || 0) * item.quantity, 0);
    }, [bundleItems]);
    const combinedRetailValue = useMemo(() => {
        return bundleItems.reduce((sum, item) => sum + (item.unitPrice || 0) * item.quantity, 0);
    }, [bundleItems]);
    // Compute max theoretical stock from constituent items
    const maxPossibleStock = useMemo(() => {
        if (bundleItems.length === 0)
            return 0;
        const stockCaps = bundleItems.map((bItem) => {
            const liveItem = inventory.find((p) => p.id === bItem.itemId);
            if (!liveItem)
                return 0;
            return Math.floor(liveItem.stock / (bItem.quantity || 1));
        });
        return Math.min(...stockCaps);
    }, [bundleItems, inventory]);
    const activeCostPrice = customCostPrice !== null ? customCostPrice : calculatedCost;
    const initializedDraft = useRef<string | null>(null);
    // Initialize form state
    useEffect(() => {
        if (!isOpen) {
            initializedDraft.current = null;
            return;
        }
        const draftKey = editingBundle?.id || 'new';
        if (initializedDraft.current === draftKey)
            return;
        initializedDraft.current = draftKey;
        setErrorMsg(null);
        if (editingBundle) {
            setTitle(editingBundle.title);
            setSku(editingBundle.sku || '');
            setCategory(editingBundle.category || 'Bundles');
            setCondition(editingBundle.condition || 'new');
            setSellingPrice(editingBundle.sellingPrice || 0);
            setCustomCostPrice(editingBundle.costPrice ?? null);
            setStock(editingBundle.stock ?? 1);
            setNotes(editingBundle.notes || '');
            setBundleItems(editingBundle.bundleItems || []);
        }
        else {
            const randomSku = `BNDL-${Math.floor(1000 + Math.random() * 9000)}`;
            setTitle('');
            setSku(randomSku);
            setCategory('Bundles');
            setCondition('new');
            setSellingPrice(0);
            setCustomCostPrice(null);
            setStock(1);
            setNotes('');
            setBundleItems([]);
            if (availableProducts.length > 0) {
                setSelectedProductId(availableProducts[0].id);
            }
        }
        setErrorMsg(null);
    }, [editingBundle, isOpen, availableProducts]);
    if (!isOpen)
        return null;
    const handleAddItemToBundle = () => {
        if (!selectedProductId)
            return;
        const product = availableProducts.find((p) => p.id === selectedProductId);
        if (!product)
            return;
        const existingIndex = bundleItems.findIndex((b) => b.itemId === selectedProductId);
        if (existingIndex >= 0) {
            // Update quantity
            const updated = [...bundleItems];
            updated[existingIndex].quantity += itemQuantityToAdd;
            setBundleItems(updated);
        }
        else {
            // Add new
            setBundleItems([
                ...bundleItems,
                {
                    itemId: product.id,
                    itemTitle: product.title,
                    quantity: itemQuantityToAdd,
                    unitCost: product.costPrice,
                    unitPrice: product.sellingPrice,
                },
            ]);
        }
        // Auto-update default title if empty
        if (!title && bundleItems.length === 0) {
            setTitle(`${product.title} Bundle`);
        }
        // Auto update suggested selling price if still zero
        if (sellingPrice === 0) {
            const addedValue = product.sellingPrice * itemQuantityToAdd;
            setSellingPrice(Math.round(addedValue * 0.95)); // 5% bundle discount
        }
        setItemQuantityToAdd(1);
    };
    const handleRemoveBundleItem = (index: number) => {
        const updated = bundleItems.filter((_, idx) => idx !== index);
        setBundleItems(updated);
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setErrorMsg('Bundle name is required.');
            return;
        }
        if (bundleItems.length === 0) {
            setErrorMsg('Please add at least 1 product to create a bundle.');
            return;
        }
        setIsSubmitting(true);
        setErrorMsg(null);
        const finalCost = Number(activeCostPrice.toFixed(2));
        const finalSelling = Number(Number(sellingPrice).toFixed(2));
        const finalStock = Number(stock) || 0;
        const bundlePayload = {
            title: title.trim(),
            sku: sku.trim() || undefined,
            category: category.trim() || 'Bundles',
            condition,
            costPrice: finalCost,
            sellingPrice: finalSelling,
            stock: finalStock,
            lowStockThreshold: 1,
            status: (finalStock === 0 ? 'out_of_stock' : 'active') as ItemStatus,
            fulfillmentType: 'both' as const,
            isBundle: true,
            bundleItems,
            notes: notes.trim() || undefined,
            createdAt: editingBundle?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: user?.uid || profile?.uid,
        };
        try {
            const savedId = await saveInventoryItem(bundlePayload, editingBundle?.id);
            onBundleSaved?.({ id: savedId, ...bundlePayload });
            onClose();
        }
        catch (err: any) {
            setErrorMsg(err.message || 'Error saving bundle');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4"/>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                {editingBundle ? 'Edit Product Bundle' : 'Create Product Bundle'}
              </h2>
              <p className="text-xs text-slate-500">Combine existing inventory products into a single discounted offer</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (<div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0"/>
              <span>{errorMsg}</span>
            </div>)}

          {/* Bundle Title & SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bundle Name *
              </label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Phone + Fast Charger + Case Kit" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bundle SKU
              </label>
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BNDL-101" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-hidden focus:bg-white"/>
            </div>
          </div>

          {/* Constituent Products Picker Box */}
          <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-indigo-600"/>
                Select Products from Inventory
              </span>
              <span className="text-[11px] text-indigo-700 font-medium">
                {bundleItems.length} product{bundleItems.length === 1 ? '' : 's'} in bundle
              </span>
            </div>

            {/* Selector Row */}
            <div className="flex items-center gap-2">
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20">
                {availableProducts.length === 0 ? (<option value="">No individual products available</option>) : (availableProducts.map((p) => (<option key={p.id} value={p.id}>
                      {p.title} (Stock: {p.stock} | Cost: DH {p.costPrice.toFixed(2)} | Price: DH {p.sellingPrice.toFixed(2)})
                    </option>)))}
              </select>

              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-slate-500 font-medium">Qty:</span>
                <input type="number" min="1" max="99" value={itemQuantityToAdd} onChange={(e) => setItemQuantityToAdd(Math.max(1, parseInt(e.target.value) || 1))} className="w-14 px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"/>
              </div>

              <button type="button" onClick={handleAddItemToBundle} disabled={availableProducts.length === 0 || !selectedProductId} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0">
                <Plus className="w-3.5 h-3.5"/>
                <span>Add</span>
              </button>
            </div>

            {/* Added Bundle Items List */}
            {bundleItems.length > 0 ? (<div className="bg-white rounded-lg border border-indigo-100 divide-y divide-slate-100 overflow-hidden shadow-xs">
                {bundleItems.map((bItem, idx) => (<div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="font-semibold text-slate-900 truncate">{bItem.itemTitle}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                        <span>Qty: <strong>{bItem.quantity}</strong></span>
                        <span>Unit Cost: DH {bItem.unitCost?.toFixed(2) || '0.00'}</span>
                        <span className="text-indigo-600 font-medium">Subtotal Cost: DH {((bItem.unitCost || 0) * bItem.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => handleRemoveBundleItem(idx)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer" title="Remove from bundle">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>))}
              </div>) : (<div className="p-3 bg-white/60 border border-dashed border-indigo-200 rounded-lg text-center text-xs text-slate-400">
                No items added yet. Pick from your inventory above to compose this bundle.
              </div>)}
          </div>

          {/* Pricing & Stock Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Cost Price */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Cost Price (DH )</label>
                <span className="text-[10px] text-slate-400">Sum: DH {calculatedCost.toFixed(2)}</span>
              </div>
              <input type="number" step="0.01" min="0" value={activeCostPrice} onChange={(e) => setCustomCostPrice(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:bg-white"/>
            </div>

            {/* Selling Price */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Selling Price (DH ) *</label>
                {combinedRetailValue > 0 && (<span className="text-[10px] text-indigo-600 font-semibold">Retail: DH {combinedRetailValue.toFixed(2)}</span>)}
              </div>
              <input type="number" step="0.01" min="0" required value={sellingPrice} onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)} placeholder="Bundle price" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:bg-white"/>
            </div>

            {/* Stock Count */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Bundle Stock *</label>
                {bundleItems.length > 0 && (<button type="button" onClick={() => setStock(maxPossibleStock)} className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer" title="Set to max available based on components">
                    Max ({maxPossibleStock})
                  </button>)}
              </div>
              <input type="number" min="0" required value={stock} onChange={(e) => setStock(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:bg-white"/>
            </div>
          </div>

          {/* Realized Profit preview bar */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Profit per Bundle Sale:</span>
            <div className="flex items-center gap-2">
              <span className={`font-black text-sm ${sellingPrice - activeCostPrice >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                +DH {(sellingPrice - activeCostPrice).toFixed(2)}
              </span>
              <span className="text-slate-400">
                ({sellingPrice > 0 ? (((sellingPrice - activeCostPrice) / sellingPrice) * 100).toFixed(0) : 0}% margin)
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Included Items Details</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Includes original accessories and free delivery" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:bg-white resize-none"/>
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs hover:bg-slate-50 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || bundleItems.length === 0} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 cursor-pointer">
              {isSubmitting ? (<span>Saving...</span>) : (<>
                  <Check className="w-3.5 h-3.5"/>
                  <span>{editingBundle ? 'Save Bundle Changes' : 'Create Bundle'}</span>
                </>)}
            </button>
          </div>
        </form>
      </div>
    </div>);
};
