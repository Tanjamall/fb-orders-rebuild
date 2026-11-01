import type {DailyDeliveryCost} from "../types";
import {
  DEMO_INVENTORY,
  DEMO_ORDERS,
  DEMO_VENDORS,
  DEMO_TEAM_MEMBERS,
  DEMO_TEAM_PAYOUTS,
} from "../demoData";
const key = "fb-orders-rebuild-demo-v2";
const fixtures = () =>
  structuredClone({
    inventory: DEMO_INVENTORY,
    orders: DEMO_ORDERS,
    vendors: DEMO_VENDORS,
    team_members: DEMO_TEAM_MEMBERS,
    team_payouts: DEMO_TEAM_PAYOUTS,
    daily_delivery_costs: [] as DailyDeliveryCost[],
  });
export type DemoTable = keyof ReturnType<typeof fixtures>;
let state = fixtures();
try {
  const saved = localStorage.getItem(key);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Object.keys(state).filter(k=>k!=="daily_delivery_costs").every((k) => Array.isArray(parsed[k])))
      state = {...parsed,daily_delivery_costs:parsed.daily_delivery_costs||[]};
  }
} catch {}
const listeners = new Set<() => void>();
export const demoRead = (table: DemoTable): any[] =>
  structuredClone(state[table]);
export const demoListen = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function demoUpdate(update: (data: typeof state) => void) {
  const next = structuredClone(state);
  update(next);
  state = next;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {}
  listeners.forEach((fn) => fn());
}
export function demoReset() {
  state = fixtures();
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {}
  listeners.forEach((fn) => fn());
}
