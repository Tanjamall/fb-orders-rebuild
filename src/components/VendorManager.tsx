import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Globe, 
  Clock, 
  Star, 
  Edit3, 
  Trash2, 
  Package, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Vendor, InventoryItem } from '../types';
import { saveVendor, deleteVendor } from '../services/db';
import { useAuth } from '../context/AuthContext';

interface VendorManagerProps {
  vendors: Vendor[];
  inventory: InventoryItem[];
  onOpenNewVendor: (initialData?: Partial<Vendor>) => void;
  onFilterInventoryByVendor?: (vendorId: string) => void;
}

export const VendorManager: React.FC<VendorManagerProps> = ({
  vendors,
  inventory,
  onOpenNewVendor,
  onFilterInventoryByVendor,
}) => {
  const { canManageVendors, canDeleteRecords } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      return (
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.contactPerson && v.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.notes && v.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
  }, [vendors, searchQuery]);

  const handleDelete = async (vendor: Vendor) => {
    if (!canDeleteRecords) return;
    if (window.confirm(`Delete vendor "${vendor.name}"?`)) {
      try {
        await deleteVendor(vendor.id);
      } catch (err) {
        console.error('Error deleting vendor', err);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Suppliers & Vendor Information
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage product sourcing channels, supplier contacts, restocking lead times, and inventory ties.
          </p>
        </div>

        {canManageVendors && (
          <button
            onClick={() => onOpenNewVendor()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vendor</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers by name or keyword..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-hidden"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {filteredVendors.length} Suppliers Active
        </span>
      </div>

      {/* Vendors Grid */}
      {filteredVendors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No suppliers found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Add suppliers, liquidators, or estate contacts to track where you buy your inventory.
          </p>
          {canManageVendors && (
            <button
              onClick={() => onOpenNewVendor()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              + Add First Vendor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVendors.map((vendor) => {
            const linkedItems = inventory.filter((i) => i.vendorId === vendor.id);

            return (
              <div
                key={vendor.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all"
              >
                <div>
                  {/* Top line with rating and actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-bold text-slate-900 text-base">{vendor.name}</h2>
                      {vendor.contactPerson && (
                        <p className="text-xs font-medium text-slate-600 mt-0.5">
                          Rep: {vendor.contactPerson}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {canManageVendors && (
                        <button
                          onClick={() => onOpenNewVendor(vendor)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {canDeleteRecords && (
                        <button
                          onClick={() => handleDelete(vendor)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rating & Lead Time badge */}
                  <div className="flex items-center gap-2 mt-2">
                    {vendor.rating ? (
                      <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-bold">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{vendor.rating.toFixed(1)}</span>
                      </div>
                    ) : null}
                    {vendor.leadTimeDays ? (
                      <div className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{vendor.leadTimeDays}d lead time</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Notes */}
                  {vendor.notes && (
                    <p className="text-xs text-slate-600 mt-3 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {vendor.notes}
                    </p>
                  )}

                  {/* Contact Methods */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    {vendor.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <a href={`tel:${vendor.phone}`} className="hover:text-blue-600">
                          {vendor.phone}
                        </a>
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <a href={`mailto:${vendor.email}`} className="hover:text-blue-600">
                          {vendor.email}
                        </a>
                      </div>
                    )}
                    {vendor.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        <a
                          href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-blue-600 flex items-center gap-1 text-blue-600"
                        >
                          <span>Portal / Website</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Linked Items Footer */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <span><strong>{linkedItems.length}</strong> items in catalog</span>
                  </div>

                  {linkedItems.length > 0 && onFilterInventoryByVendor && (
                    <button
                      onClick={() => onFilterInventoryByVendor(vendor.id)}
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>View Products</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
