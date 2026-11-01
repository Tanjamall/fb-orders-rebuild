-- Standalone rebuild: indexes and policy evaluation improvements.
create index inventory_vendor_idx on public.inventory(workspace_id,vendor_id);
create index inventory_movements_product_idx on public.inventory_movements(workspace_id,product_id);
create index orders_employee_idx on public.orders(workspace_id,confirmation_member_id);
create index orders_product_idx on public.orders(workspace_id,item_id);
create index team_payouts_member_idx on public.team_payouts(workspace_id,member_id);
create index workspace_members_user_idx on public.workspace_members(user_id);
alter policy read_own_profile on public.profiles using(id=(select auth.uid()));
alter policy read_own_membership on public.workspace_members using(user_id=(select auth.uid()));
-- Supabase's default event-trigger helper is internal, never a browser RPC.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
   revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;
