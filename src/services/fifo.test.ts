import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getItemBatches,
  getActiveFifoBatch,
  getTotalBatchStock,
  appendRestockLot,
  deductFifoStock,
} from './fifo';
import { InventoryItem } from '../types';

test('getItemBatches synthesizes initial batch for legacy items with stock', () => {
  const item: InventoryItem = {
    id: 'item_1',
    title: 'Test Chair',
    category: 'Furniture',
    condition: 'good',
    costPrice: 100,
    sellingPrice: 200,
    stock: 5,
    lowStockThreshold: 2,
    status: 'active',
    fulfillmentType: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const batches = getItemBatches(item);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].batchNumber, 1);
  assert.equal(batches[0].initialQty, 5);
  assert.equal(batches[0].remainingQty, 5);
  assert.equal(batches[0].costPrice, 100);
  assert.equal(batches[0].sellingPrice, 200);
});

test('appendRestockLot appends new batch and preserves older batch active prices while stock remains', () => {
  const item: InventoryItem = {
    id: 'item_1',
    title: 'Test Keyboard',
    category: 'Electronics',
    condition: 'new',
    costPrice: 50,
    sellingPrice: 100,
    stock: 2,
    lowStockThreshold: 1,
    status: 'active',
    fulfillmentType: 'both',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const restock = appendRestockLot(item, {
    quantity: 5,
    costPrice: 60,
    sellingPrice: 120,
    supplier: 'KeyCorp',
  });

  assert.equal(restock.updatedBatches.length, 2);
  assert.equal(restock.newStock, 7);
  // FIFO rule: Old stock remains, so active prices remain from batch 1 (old stock)
  assert.equal(restock.newCostPrice, 50);
  assert.equal(restock.newSellingPrice, 100);
});

test('appendRestockLot immediately adopts new lot prices if previous stock was zero', () => {
  const item: InventoryItem = {
    id: 'item_1',
    title: 'Test Keyboard',
    category: 'Electronics',
    condition: 'new',
    costPrice: 50,
    sellingPrice: 100,
    stock: 0,
    lowStockThreshold: 1,
    status: 'out_of_stock',
    fulfillmentType: 'both',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const restock = appendRestockLot(item, {
    quantity: 3,
    costPrice: 65,
    sellingPrice: 130,
    supplier: 'KeyCorp',
  });

  assert.equal(restock.newStock, 3);
  assert.equal(restock.newCostPrice, 65);
  assert.equal(restock.newSellingPrice, 130);
});

test('deductFifoStock sells old stock first until exhausted, then switches to new stock prices', () => {
  const item: InventoryItem = {
    id: 'item_1',
    title: 'Dual-Batch Item',
    category: 'Tools',
    condition: 'new',
    costPrice: 40,
    sellingPrice: 80,
    stock: 5,
    lowStockThreshold: 1,
    status: 'active',
    fulfillmentType: 'both',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    batches: [
      {
        id: 'b1',
        batchNumber: 1,
        receivedDate: '2026-01-01',
        initialQty: 2,
        remainingQty: 2,
        costPrice: 40,
        sellingPrice: 80,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'b2',
        batchNumber: 2,
        receivedDate: '2026-02-01',
        initialQty: 3,
        remainingQty: 3,
        costPrice: 50,
        sellingPrice: 95,
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ],
  };

  // Step 1: Sell 1 item (from batch 1)
  const sale1 = deductFifoStock(item, 1);
  assert.equal(sale1.newStock, 4);
  assert.equal(sale1.updatedBatches[0].remainingQty, 1);
  assert.equal(sale1.updatedBatches[1].remainingQty, 3);
  // Batch 1 still has 1 item, so active prices remain $40 and $80
  assert.equal(sale1.newCostPrice, 40);
  assert.equal(sale1.newSellingPrice, 80);

  // Step 2: Now sell 2 items (exhausts remaining 1 from batch 1, and takes 1 from batch 2)
  const itemAfterSale1 = { ...item, batches: sale1.updatedBatches, stock: sale1.newStock };
  const sale2 = deductFifoStock(itemAfterSale1, 2);
  assert.equal(sale2.newStock, 2);
  assert.equal(sale2.updatedBatches[0].remainingQty, 0); // Batch 1 completely exhausted!
  assert.equal(sale2.updatedBatches[1].remainingQty, 2); // Batch 2 has 2 left
  // Blended cost for this order: (1 * 40 + 1 * 50) / 2 = 45
  assert.equal(sale2.blendedUnitCost, 45);
  // Because batch 1 is now empty, active prices switch to Batch 2 ($50 cost, $95 price)!
  assert.equal(sale2.newCostPrice, 50);
  assert.equal(sale2.newSellingPrice, 95);
});
