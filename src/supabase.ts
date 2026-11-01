import { createClient } from "@supabase/supabase-js";
import { backendConfig } from "./services/backendConfig";
const config = backendConfig(import.meta.env || {});
export const isDemo = config.isDemo;
export const supabase = isDemo
  ? null
  : createClient(config.url!, config.key!, {
      auth: {
        flowType: "pkce",
        storageKey: "fb-orders-rebuild-auth",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
let workspaceId: string | null = null;
export const setActiveWorkspace = (id: string | null) => {
  workspaceId = id;
};
export const getActiveWorkspace = () => workspaceId;
export function requireWorkspace() {
  if (!supabase || !workspaceId)
    throw Error("Sign in with an approved workspace account first.");
  return { client: supabase, workspaceId };
}
export async function testConnection() {
  if (!supabase) return true;
  const { error } = await supabase.auth.getSession();
  return !error;
}
