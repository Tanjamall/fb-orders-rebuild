-- Original Tanger Orders: BUSINESS DATA EXPORT ONLY.
-- Run in the ORIGINAL project's SQL Editor, then export the result as CSV.
-- This is one SELECT statement: no inserts, updates, deletes, functions, or schema changes.
-- Includes archived products and all history, with a single statement-level snapshot.
-- Excludes Auth passwords/sessions, push credentials and workspace join codes.
-- Keep the CSV private; it contains customer and business records.
with business_export as (
  select 'workspaces'::text as table_name, coalesce(jsonb_agg(to_jsonb(t) - 'join_code'), '[]'::jsonb) as data from public.workspaces t
  union all
  select 'profiles'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.profiles t
  union all
  select 'workspace_members'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.workspace_members t
  union all
  select 'products'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.products t
  union all
  select 'orders'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.orders t
  union all
  select 'confirmation_employees'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.confirmation_employees t
  union all
  select 'inventory_batches'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.inventory_batches t
  union all
  select 'order_cost_allocations'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.order_cost_allocations t
  union all
  select 'inventory_movements'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.inventory_movements t
  union all
  select 'inventory_corrections'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.inventory_corrections t
  union all
  select 'daily_delivery_costs'::text as table_name, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.daily_delivery_costs t
  union all
  select '_schema'::text, coalesce(jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable) order by table_name,ordinal_position),'[]'::jsonb) from information_schema.columns where table_schema='public'
)
select 'tanger-business-export-v1'::text as format,
       'tsoqghvuxnoljfsbzuip'::text as source_project,
       statement_timestamp() as exported_at,
       table_name,
       jsonb_array_length(data) as row_count,
       data
from business_export
order by table_name;
