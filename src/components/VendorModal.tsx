import React, { useState, useEffect } from 'react';
import { X, Building2, Check, AlertCircle, Star } from 'lucide-react';
import { Vendor } from '../types';
import { saveVendor } from '../services/db';
import { useAuth } from '../context/AuthContext';
interface VendorModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingVendor?: Vendor | null;
}
export const VendorModal: React.FC<VendorModalProps> = ({ isOpen, onClose, editingVendor, }) => {
    const { user, profile } = useAuth();
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [website, setWebsite] = useState('');
    const [leadTimeDays, setLeadTimeDays] = useState<number>(3);
    const [rating, setRating] = useState<number>(5.0);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    useEffect(() => {
        if (editingVendor) {
            setName(editingVendor.name);
            setContactPerson(editingVendor.contactPerson || '');
            setEmail(editingVendor.email || '');
            setPhone(editingVendor.phone || '');
            setWebsite(editingVendor.website || '');
            setLeadTimeDays(editingVendor.leadTimeDays ?? 3);
            setRating(editingVendor.rating ?? 5.0);
            setNotes(editingVendor.notes || '');
        }
        else {
            setName('');
            setContactPerson('');
            setEmail('');
            setPhone('');
            setWebsite('');
            setLeadTimeDays(3);
            setRating(5.0);
            setNotes('');
        }
    }, [editingVendor, isOpen]);
    if (!isOpen)
        return null;
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setErrorMsg('Vendor / Supplier name is required.');
            return;
        }
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            await saveVendor({
                name,
                contactPerson: contactPerson || undefined,
                email: email || undefined,
                phone: phone || undefined,
                website: website || undefined,
                leadTimeDays: leadTimeDays || undefined,
                rating: rating || undefined,
                notes: notes || undefined,
                createdAt: editingVendor?.createdAt || new Date().toISOString(),
                createdBy: user?.uid || profile?.uid,
            }, editingVendor?.id);
            onClose();
        }
        catch (err: any) {
            setErrorMsg(err.message || 'Error saving vendor');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4"/>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                {editingVendor ? 'Edit Supplier' : 'Add New Sourcing Vendor'}
              </h2>
              <p className="text-xs text-slate-500">Track liquidators, wholesalers, and consignment sources</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          {errorMsg && (<div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0"/>
              <span>{errorMsg}</span>
            </div>)}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Company / Vendor Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apex Wholesale Electronics" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
              <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="David Chen" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 342-8819" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@vendor.com" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Website URL</label>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lead Time (Days)</label>
              <input type="number" min="0" value={leadTimeDays} onChange={(e) => setLeadTimeDays(parseInt(e.target.value) || 0)} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rating (1 to 5 Stars)</label>
              <input type="number" step="0.1" min="1" max="5" value={rating} onChange={(e) => setRating(parseFloat(e.target.value) || 5.0)} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Free delivery on orders over DH 500, liquidation manifests sent Tuesdays." className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"/>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50">
              <Check className="w-4 h-4"/>
              <span>{isSubmitting ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Add Vendor'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>);
};
