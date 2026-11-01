import React, { useState, useEffect } from 'react';
import { X, UserPlus, Check, AlertCircle, Phone, Mail, Award, CheckCircle2, Truck, ShoppingBag, Package, Layers } from 'lucide-react';
import { ConfirmationMember, RewardTrigger, RewardCalculationMode } from '../types';
interface TeamMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (memberData: Omit<ConfirmationMember, 'id'>, id?: string) => Promise<void>;
    editingMember?: ConfirmationMember | null;
}
export const TeamMemberModal: React.FC<TeamMemberModalProps> = ({ isOpen, onClose, onSave, editingMember, }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [baseReward, setBaseReward] = useState<number>(5);
    const [rewardTrigger, setRewardTrigger] = useState<RewardTrigger>('delivered');
    const [rewardCalculationMode, setRewardCalculationMode] = useState<RewardCalculationMode>('per_order');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    useEffect(() => {
        if (editingMember) {
            setName(editingMember.name || '');
            setPhone(editingMember.phone || '');
            setEmail(editingMember.email || '');
            setBaseReward(editingMember.baseReward ?? 5);
            setRewardTrigger(editingMember.rewardTrigger || 'delivered');
            setRewardCalculationMode(editingMember.rewardCalculationMode || 'per_order');
            setStatus(editingMember.status || 'active');
            setNotes(editingMember.notes || '');
        }
        else {
            setName('');
            setPhone('');
            setEmail('');
            setBaseReward(5);
            setRewardTrigger('delivered');
            setRewardCalculationMode('per_order');
            setStatus('active');
            setNotes('');
        }
        setErrorMsg(null);
    }, [editingMember, isOpen]);
    if (!isOpen)
        return null;
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setErrorMsg('Member name is required.');
            return;
        }
        if (baseReward < 0) {
            setErrorMsg('Base reward cannot be negative.');
            return;
        }
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            await onSave({
                name: name.trim(),
                phone: phone.trim() || undefined,
                email: email.trim() || undefined,
                baseReward: Number(baseReward) || 0,
                rewardTrigger,
                rewardCalculationMode,
                status,
                notes: notes.trim() || undefined,
                createdAt: editingMember?.createdAt || new Date().toISOString(),
            }, editingMember?.id);
            onClose();
        }
        catch (err: any) {
            setErrorMsg(err.message || 'Error saving team member');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <UserPlus className="w-4 h-4"/>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                {editingMember ? 'Edit Member' : 'Add Member'}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (<div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0"/>
              <span>{errorMsg}</span>
            </div>)}

          {/* Member Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Name *
            </label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Youssef Amrani or Sarah Benali" className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"/>
          </div>

          {/* Contact: Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3"/>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +212 661-234567" className="w-full pl-9 text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3"/>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@team.local" className="w-full pl-9 text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"/>
              </div>
            </div>
          </div>

          {/* Base Reward Rate */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500"/>
                <span>Base Reward Rate (DH ) *</span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {rewardCalculationMode === 'per_item' ? 'Per item sold' : 'Per order'}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">DH </span>
              <input type="number" step="0.5" min="0" required value={baseReward} onChange={(e) => setBaseReward(parseFloat(e.target.value) || 0)} placeholder="5.00" className="w-full pl-7 text-xs sm:text-sm p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-hidden"/>
            </div>
          </div>

          {/* Reward & Bonus Calculation Mode: Per Order vs Per Items */}
          <div className="bg-gradient-to-br from-indigo-50/60 via-blue-50/40 to-slate-50 p-3.5 rounded-xl border border-blue-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600"/>
                <span>Reward & Bonus Calculation Setting *</span>
              </label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                Multi-Item Logic
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              When a customer order contains more than one item (quantity &gt; 1), choose how this agent's base reward and upsell bonus will be calculated:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Option 1: Per Order */}
              <label className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${rewardCalculationMode === 'per_order'
            ? 'border-blue-500 bg-white shadow-xs ring-2 ring-blue-500/20'
            : 'border-slate-200 bg-white/70 hover:bg-white'}`}>
                <div className="flex items-start gap-2.5">
                  <input type="radio" name="rewardCalculationMode" value="per_order" checked={rewardCalculationMode === 'per_order'} onChange={() => setRewardCalculationMode('per_order')} className="mt-0.5"/>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <ShoppingBag className="w-3.5 h-3.5 text-blue-600"/>
                      <span>Per Order (Standard)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Fixed reward per order regardless of item quantity.
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-600 font-medium bg-slate-50 p-1.5 rounded">
                  3 items = <span className="font-bold text-slate-900">DH {baseReward.toFixed(2)}</span> flat base reward
                </div>
              </label>

              {/* Option 2: Per Items in Order */}
              <label className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${rewardCalculationMode === 'per_item'
            ? 'border-indigo-500 bg-white shadow-xs ring-2 ring-indigo-500/20'
            : 'border-slate-200 bg-white/70 hover:bg-white'}`}>
                <div className="flex items-start gap-2.5">
                  <input type="radio" name="rewardCalculationMode" value="per_item" checked={rewardCalculationMode === 'per_item'} onChange={() => setRewardCalculationMode('per_item')} className="mt-0.5"/>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Package className="w-3.5 h-3.5 text-indigo-600"/>
                      <span>Per Items in Order</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Base reward &amp; upsell bonus multiply by the number of items.
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-indigo-900 font-medium bg-indigo-50/70 p-1.5 rounded">
                  3 items = <span className="font-bold text-indigo-700">DH {(baseReward * 3).toFixed(2)}</span> (DH {baseReward.toFixed(2)} × 3 items)
                </div>
              </label>
            </div>
          </div>

          <label className="block text-xs font-semibold text-slate-700">Bonus earned at<select aria-label="Bonus earned at" value={rewardTrigger} onChange={e => setRewardTrigger(e.target.value as RewardTrigger)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 p-2 text-sm"><option value="new">Order created</option><option value="confirmed">Confirmed</option><option value="shipped">Out for delivery</option><option value="delivered">Delivered</option></select></label>
          {/* Status Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Active Status
              </label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-hidden">
                <option value="active">Active (Available for Orders)</option>
                <option value="inactive">Inactive / On Leave</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                App Access
              </label>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-medium">
                Admin Managed (No App Login)
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Internal Notes / Shift Schedule
            </label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Handles Casablanca inquiries, speaks Arabic & French, available 9 AM - 6 PM." className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-hidden"/>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50">
              <Check className="w-4 h-4"/>
              <span>
                {isSubmitting
            ? 'Saving...'
            : editingMember
                ? 'Update Member'
                : 'Add Team Member'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>);
};
