export type UserRole = 'admin' | 'manager' | 'staff' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair';
export type ItemStatus = 'active' | 'sold' | 'draft' | 'out_of_stock' | 'reserved' | 'archived';
export type ItemFulfillment = 'local' | 'shipping' | 'both';

export interface BundleItemRef {
  itemId: string;
  itemTitle: string;
  quantity: number;
  unitCost?: number;
  unitPrice?: number;
}

export interface StockBatch {
  id: string;
  batchNumber: number;
  receivedDate: string; // YYYY-MM-DD
  initialQty: number;
  remainingQty: number;
  costPrice: number;
  sellingPrice: number;
  sellingPriceKnown?: boolean;
  supplier?: string;
  notes?: string;
  createdAt: string;
}

export interface ProductVariant { id: string; label: string; stock: number; }
export interface DailyDeliveryCost { id: string; date: string; amount: number; }
export interface OrderLine { itemId?:string; itemTitle:string; quantity:number; salePrice:number; unitCost:number; basePrice?:number; costTotal?:number; variantId?:string; variantLabel?:string; variantName?:string; }

export interface InventoryItem {
  variants?: ProductVariant[];
  variantName?: string;
  historicalPlaceholder?: boolean;
  id: string;
  title: string;
  sku?: string;
  category: string;
  condition: ItemCondition;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  vendorId?: string;
  vendorName?: string;
  listingUrl?: string;
  status: ItemStatus;
  fulfillmentType: ItemFulfillment;
  notes?: string;
  isBundle?: boolean;
  bundleItems?: BundleItemRef[];
  batches?: StockBatch[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export type OrderStatus = 'new' | 'confirmed' | 'delivered' | 'cancelled' | 'completed' | 'pending_pickup' | 'shipped';
export type PaymentMethod = 'fb_pay' | 'cash' | 'venmo' | 'zelle' | 'paypal' | 'other';
export type OrderFulfillment = 'local_pickup' | 'shipping';

export type RewardTrigger = 'new' | 'confirmed' | 'shipped' | 'delivered';
export type RewardStatus = 'pending' | 'granted' | 'cancelled';
export type RewardCalculationMode = 'per_order' | 'per_item';

export interface ConfirmationMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  baseReward: number; // Base reward granted per confirmed order
  rewardTrigger: RewardTrigger; // 'confirmed' or 'delivered'
  rewardCalculationMode?: RewardCalculationMode; // 'per_order' (default) or 'per_item' (multiplied by items in order)
  status: 'active' | 'inactive';
  totalPaid?: number; // Cumulative payouts recorded
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface TeamPayout {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface Order {
  items?: OrderLine[];
  deliveredAt?: string;
  assignedToName?: string;
  sourceProject?: string;
  legacySettlementUnknown?: boolean;
  memberExtraReward?: number;
  paymentStatus?: string;
  id: string;
  itemId?: string;
  itemTitle: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
  shippingCharged: number;
  shippingCost: number;
  platformFee: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number; // in percentage e.g. 35.5
  buyerName: string;
  customerPhone?: string;
  customerAddress?: string;
  googleMapsUrl?: string;
  paymentMethod: PaymentMethod;
  fulfillmentType: OrderFulfillment;
  carrier?: string;
  trackingNumber?: string;
  status: OrderStatus;
  date: string; // YYYY-MM-DD
  deliveredDate?: string; // YYYY-MM-DD (Date order was delivered, used for profit date attribution)
  notes?: string;
  createdAt: string;
  createdBy?: string;

  // Confirmation Team & Reward Tracking
  confirmationMemberId?: string;
  confirmationMemberName?: string;
  basePrice?: number; // Base catalog price of item
  memberReward?: number; // Total reward granted to confirmation agent (deducted from net profit)
  rewardTrigger?: RewardTrigger; // When the reward is granted ('confirmed' | 'delivered')
  rewardStatus?: RewardStatus; // 'pending' | 'granted' | 'cancelled'
  rewardCalculationMode?: RewardCalculationMode; // 'per_order' or 'per_item'
}

/**
 * Calculates the member reward and bonus based on calculation mode.
 * - 'per_order': base reward is flat for the whole order, upsell bonus is per unit
 * - 'per_item': base reward and upsell bonus are both multiplied by item quantity
 */
export function calculateMemberReward(
  baseReward: number,
  basePrice: number,
  salePrice: number,
  quantity: number,
  mode: RewardCalculationMode = 'per_order'
): {
  baseTotal: number;
  upsellPerUnit: number;
  bonusTotal: number;
  totalReward: number;
} {
  const upsellPerUnit = Math.max(0, salePrice - basePrice);
  const safeQty = Math.max(1, quantity || 1);

  if (mode === 'per_item') {
    const baseTotal = Number((baseReward * safeQty).toFixed(2));
    const bonusTotal = Number((upsellPerUnit * safeQty).toFixed(2));
    const totalReward = Number((baseTotal + bonusTotal).toFixed(2));
    return { baseTotal, upsellPerUnit, bonusTotal, totalReward };
  } else {
    // per_order
    const baseTotal = Number(baseReward.toFixed(2));
    const bonusTotal = Number((upsellPerUnit * safeQty).toFixed(2));
    const totalReward = Number((baseTotal + bonusTotal).toFixed(2));
    return { baseTotal, upsellPerUnit, bonusTotal, totalReward };
  }
}

/**
 * Returns the effective profit date for an order.
 * If an order is delivered or completed, the profit date is the date it was delivered.
 * Otherwise, it falls back to the order creation date.
 */
export function getOrderProfitDate(order: Order): string {
  if (order.status === 'delivered' || order.status === 'completed') {
    return order.deliveredDate || order.date || (order.createdAt ? order.createdAt.substring(0, 10) : '');
  }
  return order.date || (order.createdAt ? order.createdAt.substring(0, 10) : '');
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  leadTimeDays?: number;
  rating?: number;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface MonthlyRevenueData {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  ordersCount: number;
  marginPercent: number;
}
