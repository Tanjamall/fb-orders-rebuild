import { InventoryItem, StockBatch } from '../types';

/**
 * Normalizes an item's stock batches.
 * If the item does not have recorded batches yet, synthesizes an initial batch
 * based on current stock, cost price, and selling price.
 */
export function getItemBatches(item: InventoryItem): StockBatch[] {
  if (item.batches && item.batches.length > 0) {
    // Return sorted by batchNumber or receivedDate ascending (FIFO order)
    return [...item.batches].sort((a, b) => {
      if (a.batchNumber && b.batchNumber) return a.batchNumber - b.batchNumber;
      return new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime();
    });
  }

  // Legacy item without batch array: synthesize initial lot
  if (item.stock > 0) {
    const initialLot: StockBatch = {
      id: `batch_${item.id}_init`,
      batchNumber: 1,
      receivedDate: (item.createdAt ? item.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      initialQty: item.stock,
      remainingQty: item.stock,
      costPrice: item.costPrice || 0,
      sellingPrice: item.sellingPrice || 0,
      supplier: item.vendorName || undefined,
      notes: 'Initial stock lot',
      createdAt: item.createdAt || new Date().toISOString(),
    };
    return [initialLot];
  }

  return [];
}

/**
 * Returns the currently active FIFO batch (oldest batch with stock remaining).
 */
export function getActiveFifoBatch(itemOrBatches: InventoryItem | StockBatch[]): StockBatch | null {
  const batches = Array.isArray(itemOrBatches) ? itemOrBatches : getItemBatches(itemOrBatches);
  return batches.find((b) => b.remainingQty > 0) || null;
}

/**
 * Returns the total remaining stock summed across all batches.
 */
export function getTotalBatchStock(batches: StockBatch[]): number {
  return batches.reduce((sum, b) => sum + (b.remainingQty || 0), 0);
}

/**
 * Appends a new restock lot to an inventory item following FIFO principles.
 * The new batch is queued after existing batches.
 * If previous stock was 0, active pricing switches immediately to the new lot.
 * If older stock remains, older lot prices remain active.
 */
export function appendRestockLot(
  item: InventoryItem,
  lot: {
    quantity: number;
    costPrice: number;
    sellingPrice: number;
    supplier?: string;
    notes?: string;
    receivedDate?: string;
  }
): {
  updatedBatches: StockBatch[];
  newStock: number;
  newCostPrice: number;
  newSellingPrice: number;
} {
  const currentBatches = getItemBatches(item);
  const now = new Date().toISOString();
  const nextBatchNum = currentBatches.length + 1;

  const newBatch: StockBatch = {
    id: `batch_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    batchNumber: nextBatchNum,
    receivedDate: lot.receivedDate || now.slice(0, 10),
    initialQty: lot.quantity,
    remainingQty: lot.quantity,
    costPrice: lot.costPrice,
    sellingPrice: lot.sellingPrice,
    supplier: lot.supplier?.trim() || item.vendorName || undefined,
    notes: lot.notes?.trim() || undefined,
    createdAt: now,
  };

  const updatedBatches = [...currentBatches, newBatch];
  const newStock = getTotalBatchStock(updatedBatches);

  // Determine active batch pricing according to FIFO
  const activeBatch = updatedBatches.find((b) => b.remainingQty > 0);
  const newCostPrice = activeBatch ? activeBatch.costPrice : lot.costPrice;
  const newSellingPrice = activeBatch ? activeBatch.sellingPrice : lot.sellingPrice;

  return {
    updatedBatches,
    newStock,
    newCostPrice,
    newSellingPrice,
  };
}

/**
 * Depletes stock using FIFO: sells oldest stock first.
 * Once older stock is exhausted, transitions to newer batches.
 */
export function deductFifoStock(
  item: InventoryItem,
  quantityToDeduct: number
): {
  updatedBatches: StockBatch[];
  newStock: number;
  newCostPrice: number;
  newSellingPrice: number;
  blendedUnitCost: number;
  blendedSellingPrice: number;
  lotsUsed: { batchNumber: number; qty: number; costPrice: number; sellingPrice: number }[];
} {
  const currentBatches = getItemBatches(item);
  if(!Number.isInteger(quantityToDeduct)||quantityToDeduct<0)throw Error('Quantity must be a non-negative whole number.');
  if(getTotalBatchStock(currentBatches)<quantityToDeduct)throw Error('Not enough stock to deliver this order.');
  let remainingNeeded = quantityToDeduct;
  let totalCostSum = 0;
  let totalSellSum = 0;
  const lotsUsed: { batchNumber: number; qty: number; costPrice: number; sellingPrice: number }[] = [];

  const updatedBatches = currentBatches.map((batch) => {
    if (remainingNeeded <= 0 || batch.remainingQty <= 0) {
      return { ...batch };
    }

    const qtyTaken = Math.min(batch.remainingQty, remainingNeeded);
    const updatedRemaining = batch.remainingQty - qtyTaken;
    remainingNeeded -= qtyTaken;

    totalCostSum += qtyTaken * batch.costPrice;
    totalSellSum += qtyTaken * batch.sellingPrice;
    lotsUsed.push({
      batchNumber: batch.batchNumber,
      qty: qtyTaken,
      costPrice: batch.costPrice,
      sellingPrice: batch.sellingPrice,
    });

    return {
      ...batch,
      remainingQty: updatedRemaining,
    };
  });

  const totalDeducted = quantityToDeduct - remainingNeeded;
  const blendedUnitCost = totalDeducted > 0 ? Number((totalCostSum / totalDeducted).toFixed(2)) : item.costPrice;
  const blendedSellingPrice = totalDeducted > 0 ? Number((totalSellSum / totalDeducted).toFixed(2)) : item.sellingPrice;

  const newStock = Math.max(0, getTotalBatchStock(updatedBatches));
  const activeBatch = updatedBatches.find((b) => b.remainingQty > 0);

  // If there's an active batch, current item cost & selling price become its prices
  // If exhausted, keep previous or last batch's prices
  const newCostPrice = activeBatch ? activeBatch.costPrice : (updatedBatches[updatedBatches.length - 1]?.costPrice ?? item.costPrice);
  const newSellingPrice = activeBatch ? activeBatch.sellingPrice : (updatedBatches[updatedBatches.length - 1]?.sellingPrice ?? item.sellingPrice);

  return {
    updatedBatches,
    newStock,
    newCostPrice,
    newSellingPrice,
    blendedUnitCost,
    blendedSellingPrice,
    lotsUsed,
  };
}
