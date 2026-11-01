import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Calendar, CheckCircle2 } from 'lucide-react';
import { ConfirmationMember, TeamPayout } from '../types';
interface PayoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: ConfirmationMember | null;
    unpaidBalance: number;
    totalEarned: number;
    onSave: (payout: Omit<TeamPayout, 'id'>) => Promise<void> | void;
}
export const PayoutModal: React.FC<PayoutModalProps> = ({ isOpen, onClose, member, unpaidBalance, totalEarned, onSave, }) => {
    const [amount, setAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (member && isOpen) {
            const defaultAmount = unpaidBalance > 0 ? unpaidBalance.toFixed(2) : '0';
            setAmount(defaultAmount);
            setPaymentMethod('Cash');
            setDate(new Date().toISOString().split('T')[0]);
            setNotes('');
            setError(null);
        }
    }, [member, unpaidBalance, isOpen]);
    if (!isOpen || !member)
        return null;
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            setError("Please enter a valid payout amount greater than DH 0.");
            return;
        }
        try {
            setIsSubmitting(true);
            setError(null);
            await onSave({
                memberId: member.id,
                memberName: member.name,
                amount: Number(numAmount.toFixed(2)),
                paymentMethod,
                date: date || new Date().toISOString().split('T')[0],
                notes: notes.trim() || undefined,
                createdAt: new Date().toISOString(),
            });
            onClose();
        }
        catch (err: any) {
            console.error('Failed to record payout:', err);
            setError(err?.message || 'Failed to record payout. Please try again.');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handlePayFull = () => {
        setAmount(Math.max(0, unpaidBalance).toFixed(2));
    };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5"/>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Record Payout</h2>
              <p className="text-xs text-slate-500 font-medium">{member.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Member Balance Card */}
        <div className="px-6 pt-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Total Earned:</span>
              <span className="font-semibold text-slate-700">DH {totalEarned.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Already Paid:</span>
              <span className="font-semibold text-slate-700">DH {(member.totalPaid || 0).toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Balance Due:</span>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${unpaidBalance > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                  DH {Math.max(0, unpaidBalance).toFixed(2)}
                </span>
                {unpaidBalance > 0 && (<button type="button" onClick={handlePayFull} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors">
                    Full
                  </button>)}
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (<div className="p-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg">
              {error}
            </div>)}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payout Amount (DH ) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">DH </span>
              <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full pl-8 pr-4 py-2.5 text-base font-semibold bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400"/>
                Method
              </label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700">
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Wafacash">Wafacash</option>
                <option value="Check">Check</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400"/>
                Date
              </label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Notes / Reference
            </label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Receipt #104, bank transfer ref" className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400"/>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-colors shadow-sm disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4"/>
              {isSubmitting ? 'Recording...' : 'Confirm Payout'}
            </button>
          </div>
        </form>
      </div>
    </div>);
};
