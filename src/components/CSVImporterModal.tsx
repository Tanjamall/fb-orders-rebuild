import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, X, Check, AlertCircle, FileText, Download, ArrowRight, Sparkles, CheckCircle2, Table } from 'lucide-react';
import { Order, OrderStatus, PaymentMethod, OrderFulfillment } from '../types';
import { batchImportOrders } from '../services/db';
interface CSVImporterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: () => void;
}
export const CSVImporterModal: React.FC<CSVImporterModalProps> = ({ isOpen, onClose, onImportComplete, }) => {
    const [file, setFile] = useState<File | null>(null);
    const [rawText, setRawText] = useState<string>('');
    const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
    const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
    const [mapping, setMapping] = useState<{
        [key: string]: string;
    }>({
        date: '',
        title: '',
        salePrice: '',
        quantity: '',
        unitCost: '',
        shippingCharged: '',
        shippingCost: '',
        platformFee: '',
        buyerName: '',
        paymentMethod: '',
        fulfillmentType: '',
        trackingNumber: '',
    });
    const [previewOrders, setPreviewOrders] = useState<Omit<Order, 'id'>[]>([]);
    const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
    const [isImporting, setIsImporting] = useState(false);
    const [importCount, setImportCount] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    if (!isOpen)
        return null;
    // Auto detect columns heuristic
    const autoMapHeaders = (headers: string[], rows: Record<string, any>[]) => {
        const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
        const newMapping: {
            [key: string]: string;
        } = {};
        const findMatch = (patterns: string[]) => {
            for (const p of patterns) {
                const idx = lowerHeaders.findIndex((h) => h === p || h.includes(p));
                if (idx !== -1)
                    return headers[idx];
            }
            return '';
        };
        newMapping.date = findMatch(['date', 'sale date', 'order date', 'time', 'created']);
        newMapping.title = findMatch(['title', 'item', 'product', 'listing', 'description', 'name']);
        newMapping.salePrice = findMatch(['price', 'sale price', 'unit price', 'gross', 'amount', 'total']);
        newMapping.quantity = findMatch(['quantity', 'qty', 'count', 'units']);
        newMapping.unitCost = findMatch(['cost', 'unit cost', 'cogs', 'purchase price']);
        newMapping.shippingCharged = findMatch(['shipping charged', 'buyer shipping', 'shipping fee', 'shipping paid by buyer']);
        newMapping.shippingCost = findMatch(['shipping cost', 'actual shipping', 'label cost', 'postage']);
        newMapping.platformFee = findMatch(['fee', 'platform fee', 'marketplace fee', 'fb fee']);
        newMapping.buyerName = findMatch(['buyer', 'customer', 'purchaser', 'name']);
        newMapping.paymentMethod = findMatch(['payment', 'method', 'payment method']);
        newMapping.fulfillmentType = findMatch(['fulfillment', 'delivery', 'shipping type', 'type']);
        newMapping.trackingNumber = findMatch(['tracking', 'tracking number', 'tracking #']);
        newMapping.customerPhone = findMatch(['phone', 'mobile', 'tel', 'cell']);
        newMapping.customerAddress = findMatch(['address', 'location', 'delivery address', 'street']);
        newMapping.googleMapsUrl = findMatch(['maps', 'google maps', 'map link', 'location url']);
        newMapping.notes = findMatch(['notes', 'note', 'comment', 'instructions']);
        setMapping(newMapping);
        generatePreview(newMapping, rows);
    };
    const handleParse = (csvString: string) => {
        setErrorMsg(null);
        Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (!results.data || results.data.length === 0) {
                    setErrorMsg('The CSV file appears to be empty.');
                    return;
                }
                const headers = results.meta.fields || [];
                setParsedHeaders(headers);
                setRawRows(results.data as Record<string, any>[]);
                autoMapHeaders(headers, results.data as Record<string, any>[]);
                setStep('mapping');
            },
            error: (err: Error) => {
                setErrorMsg('Error parsing CSV: ' + err.message);
            },
        });
    };
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (uploadedFile) {
            setFile(uploadedFile);
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                handleParse(text);
            };
            reader.readAsText(uploadedFile);
        }
    };
    const handlePasteSubmit = () => {
        if (!rawText.trim()) {
            setErrorMsg('Please paste valid CSV content.');
            return;
        }
        handleParse(rawText);
    };
    const generatePreview = (currentMap: {
        [key: string]: string;
    }, rows: Record<string, any>[]) => {
        const list: Omit<Order, 'id'>[] = [];
        const today = new Date().toISOString().slice(0, 10);
        for (const r of rows) {
            const title = String(r[currentMap.title] || r[currentMap.title || ''] || 'Marketplace Item').trim();
            if (!title)
                continue;
            let date = String(r[currentMap.date] || '').trim();
            if (!date || isNaN(Date.parse(date))) {
                date = today;
            }
            else {
                try {
                    date = new Date(date).toISOString().slice(0, 10);
                }
                catch {
                    date = today;
                }
            }
            const salePrice = parseFloat(String(r[currentMap.salePrice] || '0').replace(/[^0-9.-]+/g, '')) || 0;
            const quantity = Math.max(1, parseInt(String(r[currentMap.quantity] || '1').replace(/[^0-9]+/g, '')) || 1);
            const unitCost = parseFloat(String(r[currentMap.unitCost] || '0').replace(/[^0-9.-]+/g, '')) || 0;
            const shippingCharged = parseFloat(String(r[currentMap.shippingCharged] || '0').replace(/[^0-9.-]+/g, '')) || 0;
            const shippingCost = parseFloat(String(r[currentMap.shippingCost] || '0').replace(/[^0-9.-]+/g, '')) || 0;
            const platformFee = parseFloat(String(r[currentMap.platformFee] || '0').replace(/[^0-9.-]+/g, '')) || 0;
            const buyerName = String(r[currentMap.buyerName] || 'Marketplace Buyer').trim();
            const rawPay = String(r[currentMap.paymentMethod] || '').toLowerCase();
            let paymentMethod: PaymentMethod = 'fb_pay';
            if (rawPay.includes('cash'))
                paymentMethod = 'cash';
            else if (rawPay.includes('venmo'))
                paymentMethod = 'venmo';
            else if (rawPay.includes('zelle'))
                paymentMethod = 'zelle';
            else if (rawPay.includes('paypal'))
                paymentMethod = 'paypal';
            const rawFul = String(r[currentMap.fulfillmentType] || '').toLowerCase();
            const fulfillmentType: OrderFulfillment = rawFul.includes('local') || rawFul.includes('pickup') || paymentMethod === 'cash' ? 'local_pickup' : 'shipping';
            const totalRevenue = Number((salePrice * quantity + shippingCharged).toFixed(2));
            const totalCost = Number((unitCost * quantity + shippingCost + platformFee).toFixed(2));
            const netProfit = Number((totalRevenue - totalCost).toFixed(2));
            const profitMargin = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;
            list.push({
                itemTitle: title,
                quantity,
                salePrice,
                unitCost,
                shippingCharged,
                shippingCost,
                platformFee,
                totalRevenue,
                totalCost,
                netProfit,
                profitMargin,
                buyerName,
                customerPhone: String(r[currentMap.customerPhone] || '').trim() || undefined,
                customerAddress: String(r[currentMap.customerAddress] || '').trim() || undefined,
                googleMapsUrl: String(r[currentMap.googleMapsUrl] || '').trim() || undefined,
                paymentMethod,
                fulfillmentType,
                trackingNumber: String(r[currentMap.trackingNumber] || '').trim(),
                status: 'new' as OrderStatus,
                date,
                notes: String(r[currentMap.notes] || '').trim() || undefined,
                createdAt: new Date().toISOString(),
            });
        }
        setPreviewOrders(list);
    };
    const handleMappingChange = (field: string, header: string) => {
        const updated = { ...mapping, [field]: header };
        setMapping(updated);
        generatePreview(updated, rawRows);
    };
    const handleExecuteImport = async () => {
        if (previewOrders.length === 0)
            return;
        setIsImporting(true);
        setErrorMsg(null);
        try {
            const count = await batchImportOrders(previewOrders);
            setImportCount(count);
            setTimeout(() => {
                onImportComplete();
                onClose();
            }, 1500);
        }
        catch (err: any) {
            setErrorMsg('Import error: ' + (err.message || 'Failed to save orders'));
            setIsImporting(false);
        }
    };
    const downloadSampleTemplate = () => {
        const csvContent = 'Date,Item Title,Quantity,Sale Price,Unit Cost,Shipping Charged,Shipping Cost,Platform Fee,Buyer Name,Payment Method,Fulfillment,Tracking Number\n' +
            '2026-10-12,"Sony WH-1000XM5 Headphones",1,280.00,160.00,0.00,0.00,0.00,"Jake Thornton",Cash,Local Pickup,\n' +
            '2026-10-18,"Nintendo Switch OLED White",1,299.00,210.00,14.50,11.20,15.00,"Melissa Adams",FB Pay,Shipping,9400111899562810394833\n' +
            '2026-10-24,"Oak Farmhouse Dining Bench",1,145.00,45.00,0.00,0.00,0.00,"Derek Foster",Venmo,Local Pickup,\n';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'sample_fb_marketplace_sales_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    return (<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Upload className="w-4 h-4"/>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Automated Sales History CSV Import</h2>
              <p className="text-xs text-slate-500">Import Facebook Marketplace sales reports or custom sales spreadsheets</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (<div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0"/>
              <span>{errorMsg}</span>
            </div>)}

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 text-xs font-semibold">
            <span className={`px-3 py-1 rounded-full ${step === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              1. Upload File
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300"/>
            <span className={`px-3 py-1 rounded-full ${step === 'mapping' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              2. Map Columns
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300"/>
            <span className={`px-3 py-1 rounded-full ${step === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              3. Review & Import
            </span>
          </div>

          {/* STEP 1: Upload */}
          {step === 'upload' && (<div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs font-medium">
                  <button onClick={() => setInputMode('file')} className={`px-3 py-1.5 rounded-md ${inputMode === 'file' ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-slate-600'}`}>
                    Upload .CSV File
                  </button>
                  <button onClick={() => setInputMode('paste')} className={`px-3 py-1.5 rounded-md ${inputMode === 'paste' ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-slate-600'}`}>
                    Paste CSV Text
                  </button>
                </div>

                <button onClick={downloadSampleTemplate} className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer">
                  <Download className="w-3.5 h-3.5"/>
                  <span>Download Sample Template</span>
                </button>
              </div>

              {inputMode === 'file' ? (<label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/30">
                  <FileText className="w-12 h-12 text-blue-500 mb-2"/>
                  <span className="font-bold text-slate-800 text-sm">
                    {file ? file.name : 'Click to choose a CSV file or drag & drop'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    Accepts exported sales logs from Facebook Marketplace, Excel, or Google Sheets
                  </span>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden"/>
                </label>) : (<div className="space-y-2">
                  <textarea rows={8} value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Date,Item Title,Quantity,Sale Price,Unit Cost,Shipping Charged..." className="w-full p-3 font-mono text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"/>
                  <button onClick={handlePasteSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer">
                    Parse CSV Data
                  </button>
                </div>)}
            </div>)}

          {/* STEP 2: Column Mapping */}
          {step === 'mapping' && (<div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Map CSV Columns to Order Fields</h3>
                  <p className="text-xs text-slate-500">Auto-detected best matches. Confirm or change any column below.</p>
                </div>
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3"/>
                  {rawRows.length} Rows Detected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                { key: 'title', label: 'Item Title *', required: true },
                { key: 'date', label: 'Sale Date *', required: true },
                { key: 'salePrice', label: "Sale Price (DH ) *", required: true },
                { key: 'quantity', label: 'Quantity' },
                { key: 'unitCost', label: "Unit Purchase Cost (DH )" },
                { key: 'shippingCharged', label: 'Shipping Charged to Buyer' },
                { key: 'shippingCost', label: 'Actual Shipping Label Cost' },
                { key: 'platformFee', label: "FB / Payment Fee (DH )" },
                { key: 'buyerName', label: 'Buyer Name' },
                { key: 'paymentMethod', label: 'Payment Method' },
                { key: 'fulfillmentType', label: 'Fulfillment (Local/Ship)' },
                { key: 'trackingNumber', label: 'Tracking Number' },
            ].map((field) => (<div key={field.key} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      {field.label}
                    </label>
                    <select value={mapping[field.key] || ''} onChange={(e) => handleMappingChange(field.key, e.target.value)} className="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-hidden">
                      <option value="">-- Do Not Import / Default --</option>
                      {parsedHeaders.map((h) => (<option key={h} value={h}>
                          {h}
                        </option>))}
                    </select>
                  </div>))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button onClick={() => setStep('upload')} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900">
                  ← Back to Upload
                </button>
                <button onClick={() => setStep('preview')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <span>Preview ({previewOrders.length} records)</span>
                  <ArrowRight className="w-4 h-4"/>
                </button>
              </div>
            </div>)}

          {/* STEP 3: Preview & Commit */}
          {step === 'preview' && (<div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Previewing {previewOrders.length} Sales to Import
                  </h3>
                  <p className="text-xs text-slate-500">
                    Calculated revenues, shipping expenses, and net profit margins are shown below.
                  </p>
                </div>
                <button onClick={() => setStep('mapping')} className="text-xs text-blue-600 hover:underline font-semibold">
                  Adjust Column Mapping
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Item Title</th>
                      <th className="p-2.5">Qty</th>
                      <th className="p-2.5">Price</th>
                      <th className="p-2.5">Gross Rev</th>
                      <th className="p-2.5">Net Profit</th>
                      <th className="p-2.5">Buyer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewOrders.slice(0, 15).map((o, idx) => (<tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-500">{o.date}</td>
                        <td className="p-2.5 font-semibold text-slate-900 max-w-xs truncate">{o.itemTitle}</td>
                        <td className="p-2.5">{o.quantity}</td>
                        <td className="p-2.5">DH {o.salePrice}</td>
                        <td className="p-2.5 font-bold text-blue-700">DH {o.totalRevenue}</td>
                        <td className="p-2.5 font-bold text-emerald-700">+DH {o.netProfit}</td>
                        <td className="p-2.5 text-slate-600">{o.buyerName}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
              {previewOrders.length > 15 && (<p className="text-[11px] text-slate-400 text-center">
                  Showing first 15 of {previewOrders.length} rows...
                </p>)}
            </div>)}

          {/* Success State */}
          {importCount !== null && (<div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600"/>
              <span>Successfully imported {importCount} sales into your database! Updating dashboard...</span>
            </div>)}

        </div>

        {/* Footer */}
        {step === 'preview' && (<div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button onClick={() => setStep('mapping')} className="px-3 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium">
              Back
            </button>
            <button onClick={handleExecuteImport} disabled={isImporting || previewOrders.length === 0} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer">
              <Check className="w-4 h-4"/>
              <span>{isImporting ? 'Importing Sales...' : `Confirm & Import ${previewOrders.length} Sales`}</span>
            </button>
          </div>)}

      </div>
    </div>);
};
