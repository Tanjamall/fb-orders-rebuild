export function backendConfig(env: Record<string, string | undefined>) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (url) {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase().includes("tsoqghvuxnoljfsbzuip"))
      throw Error("Golden rule: the original Supabase project is blocked.");
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw Error("Invalid Supabase URL.");
  }
  const mode = env.VITE_DATA_MODE || "demo";
  if (!["demo", "supabase"].includes(mode))
    throw Error("VITE_DATA_MODE must be demo or supabase.");
  if (key?.startsWith("sb_secret_"))
    throw Error("Never use a secret Supabase key in the browser.");
  if (key?.split(".").length === 3) {
    let role = "";
    try {
      role = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).role;
    } catch {
      throw Error("Invalid browser key.");
    }
    if (role !== "anon")
      throw Error("Only an anon or publishable browser key is allowed.");
  }
  if (mode === "supabase" && (!url || !key))
    throw Error(
      "Configure this rebuild with its own Supabase URL and publishable key.",
    );
  if (
    mode === "supabase" &&
    !key!.startsWith("sb_publishable_") &&
    key!.split(".").length !== 3
  )
    throw Error("Invalid Supabase browser key.");
  return { isDemo: mode === "demo", url, key };
}
export function toDatabase(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, v]) =>
          v !== undefined &&
          ![
            "id",
            "workspaceId",
            "createdBy",
            "updatedAt",
            "totalPaid",
          ].includes(key),
      )
      .map(([key, v]) => [
        key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()),
        v,
      ]),
  );
}
export function fromDatabase<T>(value: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => !["workspace_id", "stock_allocations"].includes(k))
      .map(([key, v]) => [
        key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        v === null ? undefined : v,
      ]),
  ) as T;
}
export const businessToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
