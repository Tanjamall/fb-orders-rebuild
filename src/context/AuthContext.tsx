import React, { createContext, useContext, useEffect, useState } from "react";
import { isDemo, supabase, setActiveWorkspace } from "../supabase";
import type { UserProfile, UserRole } from "../types";
interface AuthUser {
  uid: string;
  email?: string;
}
interface WorkspaceChoice { id:string; name:string; role:UserRole; defaultDeliveryCharge:number; sourceOrderCount:number; }
interface AuthContextType {
  workspaces:WorkspaceChoice[];
  switchWorkspace:(id:string)=>void;
  defaultDeliveryCharge:number;
  setDefaultDeliveryCharge:(amount:number)=>Promise<void>;
  user: AuthUser | null;
  profile: UserProfile | null;
  activeRole: UserRole;
  isSimulatedRole: boolean;
  setSimulatedRole: (role: UserRole | null) => void;
  loading: boolean;
  workspaceId: string | null;
  authError: string | null;
  canManageTeam: boolean;
  canEditInventory: boolean;
  canDeleteRecords: boolean;
  canViewFinancials: boolean;
  canManageVendors: boolean;
  canImportCSV: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  updateUserRole: (uid: string, role: UserRole) => Promise<void>;
}
const Context = createContext<AuthContextType | undefined>(undefined);
const demoProfile: UserProfile = {
  uid: "demo-user-1",
  email: "demo@local.invalid",
  displayName: "Local demo",
  role: "admin",
};
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(
    isDemo ? demoProfile : null,
  );
  const [workspaces,setWorkspaces]=useState<WorkspaceChoice[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isDemo);
  const [authError, setAuthError] = useState<string | null>(null);
  const [simulatedRole, setSimulation] = useState<UserRole | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let disposed = false;
    let revision = 0;
    let loadedUser:string|null=null;
    const load = async (session: any) => {
      if(session?.user.id&&session.user.id===loadedUser)return;
      loadedUser=null;
      const request = ++revision;
      setLoading(true);
      setActiveWorkspace(null);
      setWorkspaceId(null);
      setProfile(null);
      setSimulation(null);
      setUser(
        session ? { uid: session.user.id, email: session.user.email } : null,
      );
      setAuthError(null);
      try {
        if (session) {
          const { data: memberships, error } = await client
            .from("workspace_members")
            .select("workspace_id,role,workspaces(id,name,default_delivery_charge,source_order_count)")
            .eq("user_id", session.user.id);
          if (error) throw error;
          const choices:WorkspaceChoice[]=(memberships||[]).map((m:any)=>({
            id:m.workspace_id, role:m.role, name:m.workspaces?.name||'Workspace',
            defaultDeliveryCharge:Number(m.workspaces?.default_delivery_charge||0),
            sourceOrderCount:Number(m.workspaces?.source_order_count||0)
          })).sort((a,b)=>b.sourceOrderCount-a.sourceOrderCount||a.name.localeCompare(b.name));
          if (!choices.length) throw Error("Your account has no approved workspace membership. Ask the workspace owner to add you.");
          if (disposed || request !== revision) return;
          const stored=localStorage.getItem('fb-orders-rebuild-workspace:'+session.user.id);
          const choice=choices.find(w=>w.id===stored)||choices[0];
          setWorkspaces(choices);
          loadedUser=session.user.id;
          const data={workspace_id:choice.id,role:choice.role};
          setActiveWorkspace(data.workspace_id);
          setWorkspaceId(data.workspace_id);
          setProfile({
            uid: session.user.id,
            email: session.user.email || "",
            displayName:
              session.user.user_metadata?.full_name ||
              session.user.email ||
              "Team member",
            role: data.role,
          });
        }
      } catch (e) {
        if (!disposed && request === revision)
          setAuthError((e as Error).message);
      } finally {
        if (!disposed && request === revision) setLoading(false);
      }
    };
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (!disposed) void load(session);
      }, 0);
    });
    return () => {
      disposed = true;
      revision++;
      subscription.unsubscribe();
      setActiveWorkspace(null);
    };
  }, []);
  const role: UserRole =
    (isDemo ? simulatedRole : null) || profile?.role || "viewer";
  const allowed = isDemo || Boolean(workspaceId && profile);
  const login = async () => {
    if (!supabase) {
      setAuthError(
        "Local demo only. Configure a separate Supabase development project to test sign-in.",
      );
      return;
    }
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  };
  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) throw Error("Sign-in requires the development backend.");
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  };
  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) throw Error("Sign-up requires the development backend.");
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
    return Boolean(data.session);
  };
  const logout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(error.message);
        return;
      }
    }
    setActiveWorkspace(null);
    setWorkspaceId(null);
    setUser(null);
    setProfile(isDemo ? demoProfile : null);
    setSimulation(null);
  };
  const switchWorkspace = (id:string) => {
    const choice=workspaces.find(w=>w.id===id);
    if(!choice||!user) return;
    setActiveWorkspace(id);setWorkspaceId(id);setProfile(p=>p?{...p,role:choice.role}:p);setSimulation(null);
    localStorage.setItem('fb-orders-rebuild-workspace:'+user.uid,id);
  };
  const setDefaultDeliveryCharge = async (amount:number) => {
    if(!supabase||!workspaceId)throw Error('Workspace required');
    const {error}=await supabase.rpc('save_workspace_settings',{target_workspace:workspaceId,delivery_default:amount});
    if(error)throw Error(error.message);
    setWorkspaces(list=>list.map(w=>w.id===workspaceId?{...w,defaultDeliveryCharge:amount}:w));
  };
  const updateUserRole = async (uid: string, newRole: UserRole) => {
    if (isDemo) return;
    if (!supabase || !workspaceId || role !== "admin")
      throw Error("Admin access required.");
    const { error } = await supabase.rpc("set_member_role", {
      target_workspace: workspaceId,
      target_user: uid,
      new_role: newRole,
    });
    if (error) throw error;
  };
  return (
    <Context.Provider
      value={{
        user,
        workspaces,
        switchWorkspace,
        defaultDeliveryCharge:workspaces.find(w=>w.id===workspaceId)?.defaultDeliveryCharge||0,
        setDefaultDeliveryCharge,
        profile,
        activeRole: role,
        isSimulatedRole: isDemo && simulatedRole !== null,
        setSimulatedRole: (next) => {
          if (isDemo) setSimulation(next);
        },
        loading,
        workspaceId,
        authError,
        canManageTeam: allowed && role === "admin",
        canEditInventory:
          allowed && ["admin", "manager", "staff"].includes(role),
        canDeleteRecords: allowed && ["admin", "manager"].includes(role),
        canViewFinancials: allowed && ["admin", "manager"].includes(role),
        canManageVendors: allowed && ["admin", "manager"].includes(role),
        canImportCSV: allowed && ["admin", "manager"].includes(role),
        login,
        logout,
        signInWithEmail,
        signUpWithEmail,
        updateUserRole,
      }}
    >
      {children}
    </Context.Provider>
  );
};
export const useAuth = () => {
  const context = useContext(Context);
  if (!context) throw Error("Missing AuthProvider");
  return context;
};
