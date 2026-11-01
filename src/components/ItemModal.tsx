import type { ProductVariant } from "../types";
import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, Check, AlertCircle, ExternalLink, Percent, Building2 } from 'lucide-react';
import { InventoryItem, Vendor, ItemCondition, ItemStatus, ItemFulfillment } from '../types';
import { saveInventoryItem } from '../services/db';
import { useAuth } from '../context/AuthContext';
interface ItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    vendors: Vendor[];
    editingItem?: InventoryItem | null;
}
export const ItemModal: React.FC<ItemModalProps> = ({ isOpen, onClose, vendors, editingItem, }) => {
    const { user, profile, canViewFinancials } = useAuth();
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [variantName, setVariantName] = useState('Color');
    const [title, setTitle] = useState('');
    const [sku, setSku] = useState('');
    const [category, setCategory] = useState('Electronics');
    const [condition, setCondition] = useState<ItemCondition>('new');
    const [costPrice, setCostPrice] = useState<number>(0);
    const [sellingPrice, setSellingPrice] = useState<number>(0);
    const [stock, setStock] = useState<number>(1);
    const [lowStockThreshold, setLowStockThreshold] = useState<number>(2);
    const [vendorId, setVendorId] = useState<string>('');
    const [listingUrl, setListingUrl] = useState('');
    const [status, setStatus] = useState<ItemStatus>('active');
    const [fulfillmentType, setFulfillmentType] = useState<ItemFulfillment>('both');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    useEffect(() => {
        setVariants(editingItem?.variants || []);
        setVariantName(editingItem?.variantName || "Color");
        if (editingItem) {
            setTitle(editingItem.title);
            setSku(editingItem.sku || '');
            setCategory(editingItem.category || 'Electronics');
            setCondition(editingItem.condition || 'new');
            setCostPrice(editingItem.costPrice || 0);
            setSellingPrice(editingItem.sellingPrice || 0);
            setStock(editingItem.stock ?? 1);
            setLowStockThreshold(editingItem.lowStockThreshold ?? 2);
            setVendorId(editingItem.vendorId || '');
            setListingUrl(editingItem.listingUrl || '');
            setStatus(editingItem.status || 'active');
            setFulfillmentType(editingItem.fulfillmentType || 'both');
            setNotes(editingItem.notes || '');
        }
        else {
            setTitle('');
            setSku('');
            setCategory('Electronics');
            setCondition('new');
            setCostPrice(0);
            setSellingPrice(0);
            setStock(1);
            setLowStockThreshold(2);
            setVendorId('');
            setListingUrl('');
            setStatus('active');
            setFulfillmentType('both');
            setNotes('');
        }
    }, [editingItem, isOpen]);
    const potentialProfit = useMemo(() => {
        return Number((sellingPrice - costPrice).toFixed(2));
    }, [sellingPrice, costPrice]);
    const potentialMargin = useMemo(() => {
        return sellingPrice > 0 ? Number(((potentialProfit / sellingPrice) * 100).toFixed(1)) : 0;
    }, [sellingPrice, potentialProfit]);
    if (!isOpen)
        return null;
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setErrorMsg('Item title is required.');
            return;
        }
        setIsSubmitting(true);
        setErrorMsg(null);
        const selectedVendor = vendors.find((v) => v.id === vendorId);
        try {
            await saveInventoryItem({
                title,
                variants,
                variantName,
                sku,
                category,
                condition,
                costPrice,
                sellingPrice,
                stock,
                lowStockThreshold,
                vendorId: vendorId || undefined,
                vendorName: selectedVendor?.name || undefined,
                listingUrl: listingUrl || undefined,
                status: stock === 0 && status !== 'archived' ? 'out_of_stock' : status,
                fulfillmentType,
                notes,
                createdAt: editingItem?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: user?.uid || profile?.uid,
            }, editingItem?.id);
            onClose();
        }
        catch (err: any) {
            setErrorMsg(err.message || 'Error saving item');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Package className="w-4 h-4"/>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                {editingItem ? 'Edit Inventory Item' : 'Add Facebook Marketplace Item'}
              </h2>
              <p className="text-xs text-slate-500">Configure stock counts, low stock alerts, and vendor sourcing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (<div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0"/>
              <span>{errorMsg}</span>
            </div>)}

          {/* Title & SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Product Title *</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Apple iPhone 14 Pro 128GB Deep Purple" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SKU / Barcode</label>
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="IPH-14P-128" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-hidden"/>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 p-3">
            <div className="mb-3 flex items-center justify-between"><label className="text-sm font-semibold text-slate-700">Variants<input aria-label="Variant type" value={variantName} onChange={e => setVariantName(e.target.value)} placeholder="Color" className="ml-2 w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"/></label><button type="button" onClick={() => setVariants(v => [...v, { id: crypto.randomUUID(), label: '', stock: 0 }])} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Add variant</button></div>
            {variants.map((v, index) => <div key={v.id} className="mb-2 grid grid-cols-[1fr_5rem_auto] gap-2"><input aria-label={'Variant name ' + (index + 1)} required value={v.label} onChange={e => setVariants(old => old.map(x => x.id === v.id ? { ...x, label: e.target.value } : x))} placeholder="Black" className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm"/><input aria-label={'Variant stock ' + (index + 1)} type="number" min="0" step="1" required value={v.stock} onChange={e => setVariants(old => old.map(x => x.id === v.id ? { ...x, stock: Number(e.target.value) } : x))} className="rounded-lg border border-slate-300 px-2 text-sm"/><button type="button" disabled={!!editingItem && v.stock > 0} onClick={() => setVariants(old => old.filter(x => x.id !== v.id))} aria-label={'Remove variant ' + (index + 1)} className="px-2 text-sm text-slate-500 disabled:opacity-30">×</button></div>)}
          </section>

          {/* Category & Condition */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Marketplace Category</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Electronics, Furniture, Tools..." className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value as ItemCondition)} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium">
                <option value="new">Brand New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Listing Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as ItemStatus)} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold">
                <option value="active">Active Listing</option>
                <option value="draft">Draft</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Listed Price (DH ) *</label>
              <input type="number" step="0.01" min="0" required value={sellingPrice} onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)} className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"/>
            </div>

            {canViewFinancials ? (<div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Unit Cost (DH ) *</label>
                <input type="number" step="0.01" min="0" required value={costPrice} onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)} className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700"/>
              </div>) : null}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Current Stock (Units)</label>
              <input type="number" min="0" required value={variants.length ? variants.reduce((n, v) => n + v.stock, 0) : stock} readOnly={variants.length > 0} onChange={(e) => setStock(Math.max(0, parseInt(e.target.value) || 0))} className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-bold"/>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Low Stock Alert (≤)
              </label>
              <input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(Math.max(0, parseInt(e.target.value) || 0))} className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-medium"/>
            </div>
          </div>

          {/* Profit Preview Pill */}
          {canViewFinancials && (<div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-800">Potential Unit Profit:</span>
              <span className="font-bold text-emerald-800">
                +DH {potentialProfit.toFixed(2)} ({potentialMargin}% margin)
              </span>
            </div>)}

          {/* Supplier & Fulfillment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Vendor Source</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden">
                <option value="">-- No Sourcing Linked --</option>
                {vendors.map((v) => (<option key={v.id} value={v.id}>
                    {v.name} {v.leadTimeDays ? `(${v.leadTimeDays}d lead)` : ''}
                  </option>))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fulfillment Preference</label>
              <select value={fulfillmentType} onChange={(e) => setFulfillmentType(e.target.value as ItemFulfillment)} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden">
                <option value="both">Both Local Pickup & Shipping</option>
                <option value="local">Local Safe Pickup Only (Cash / Bulky)</option>
                <option value="shipping">Nationwide Shipping Only</option>
              </select>
            </div>
          </div>

          {/* Facebook Marketplace Listing URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Facebook Marketplace Listing URL</label>
            <input type="url" value={listingUrl} onChange={(e) => setListingUrl(e.target.value)} placeholder="https://facebook.com/marketplace/item/..." className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Internal Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Battery health 94%, stored in Shelf 3B, comes with charger." className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50">
              <Check className="w-4 h-4"/>
              <span>{isSubmitting ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item to Catalog'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>);
};
