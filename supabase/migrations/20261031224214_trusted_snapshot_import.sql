-- Trusted, target-only import. No browser grants, no source connection and no normal delivery RPCs.
alter table private.migration_runs add column state text not null default 'staging' check(state in ('staging','complete')),add column completed_at timestamptz;
create function private.finalize_original_import(import_run uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare run private.migration_runs;row_data jsonb;entry record;expected jsonb;actual_count integer;expected_count integer;wids uuid[];month_row jsonb;actual jsonb;source_rows integer;import_summary jsonb;target_table text;
begin
 select * into strict run from private.migration_runs where id=import_run for update;
 if run.state='complete' then return run.summary;end if;
 if run.source_project<>'tsoqghvuxnoljfsbzuip' then raise exception 'Unexpected source project';end if;
 if not exists(select 1 from auth.users where id=run.owner_id and email_confirmed_at is not null) then raise exception 'Confirmed target owner required';end if;
 select payload into strict expected from private.source_records where run_id=import_run and table_name='_expected' and row_number=0;
 if expected->>'sourceHash'<>run.source_sha256 then raise exception 'Snapshot checksum mismatch';end if;
 for entry in select * from (values ('workspaces','workspaces'),('employees','team_members'),('inventory','inventory'),('orders','orders'),('daily','daily_delivery_costs'),('movements','inventory_movements')) a(plan_table,live_table) loop
  select count(*) into source_rows from private.source_records where run_id=import_run and table_name='_target_'||entry.plan_table;
  if source_rows<>(expected->'counts'->>entry.plan_table)::integer then raise exception 'Incomplete staged table %',entry.plan_table;end if;
  for row_data in select payload from private.source_records where run_id=import_run and table_name='_target_'||entry.plan_table loop
   execute format('select count(*) from public.%I where id=$1',entry.live_table) into actual_count using (row_data->>'id')::uuid;
   if actual_count>0 then raise exception 'Import would overwrite an existing % record',entry.live_table;end if;
  end loop;
 end loop;
 if (select count(*) from private.source_records where run_id=import_run and table_name='orders')<>(expected->'counts'->>'orders')::integer then raise exception 'Source order count mismatch';end if;
 select array_agg((payload->>'id')::uuid) into wids from private.source_records where run_id=import_run and table_name='_target_workspaces';
 for row_data in select payload from private.source_records where run_id=import_run and table_name='_target_workspaces' order by row_number loop
  insert into public.workspaces select (jsonb_populate_record(null::public.workspaces,row_data)).*;
  insert into public.workspace_members(workspace_id,user_id,role) values((row_data->>'id')::uuid,run.owner_id,'admin');
 end loop;
 for entry in select * from (values ('employees','team_members'),('inventory','inventory'),('orders','orders'),('daily','daily_delivery_costs'),('movements','inventory_movements')) a(plan_table,live_table) loop
  for row_data in select payload from private.source_records where run_id=import_run and table_name='_target_'||entry.plan_table order by row_number loop
   if not ((row_data->>'workspace_id')::uuid=any(wids)) then raise exception 'Target record crosses snapshot workspace boundary';end if;
   execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).*',entry.live_table,entry.live_table) using row_data;
  end loop;
 end loop;
 -- Historical orders were inserted directly: neither stock nor old bonuses are recalculated.
 for entry in select * from (values ('workspaces','workspaces'),('employees','team_members'),('inventory','inventory'),('orders','orders'),('daily','daily_delivery_costs'),('movements','inventory_movements')) a(plan_table,live_table) loop
  if entry.live_table='workspaces' then select count(*) into actual_count from public.workspaces where id=any(wids);
  else execute format('select count(*) from public.%I where workspace_id=any($1)',entry.live_table) into actual_count using wids;end if;
  expected_count:=(expected->'counts'->>entry.plan_table)::integer;
  if actual_count<>expected_count then raise exception 'Reconciliation count failed for %',entry.live_table;end if;
 end loop;
 if exists(select 1 from public.inventory p where workspace_id=any(wids) and not is_bundle and stock<>(select coalesce(sum((b->>'remainingQty')::integer),0) from jsonb_array_elements(p.batches) b)) then raise exception 'Stock and FIFO batches do not reconcile';end if;
 if exists(select 1 from public.inventory p where workspace_id=any(wids) and jsonb_array_length(variants)>0 and stock<>(select sum((v->>'stock')::integer) from jsonb_array_elements(p.variants) v)) then raise exception 'Variant stock does not reconcile';end if;
 if exists(select 1 from public.inventory p where workspace_id=any(wids) and historical_placeholder and (status<>'archived' or stock<>0 or title<>'Deleted product')) then raise exception 'Deleted product placeholder mismatch';end if;
 for month_row in select value from jsonb_array_elements(expected->'monthly') loop
  select jsonb_build_object('orders',count(*),'revenue',coalesce(sum(total_revenue),0)*100,'cost',coalesce(sum(total_cost-shipping_cost-platform_fee),0)*100,'delivery',coalesce(sum(shipping_cost),0)*100,'other',coalesce(sum(platform_fee),0)*100,'reward',coalesce(sum(member_reward),0)*100,'profit',coalesce(sum(net_profit),0)*100-(select coalesce(sum(amount),0)*100 from public.daily_delivery_costs where workspace_id=(month_row->>'workspace_id')::uuid and to_char(date,'YYYY-MM')=month_row->>'month')) into actual
  from public.orders where workspace_id=(month_row->>'workspace_id')::uuid and status in ('delivered','completed') and to_char(delivered_date,'YYYY-MM')=month_row->>'month';
  if (actual->>'orders')::numeric<>(month_row->>'delivered_orders')::numeric or (actual->>'revenue')::numeric<>(month_row->>'revenue_cents')::numeric or (actual->>'cost')::numeric<>(month_row->>'product_cost_cents')::numeric or (actual->>'delivery')::numeric<>(month_row->>'order_delivery_cents')::numeric or (actual->>'other')::numeric<>(month_row->>'other_cost_cents')::numeric or (actual->>'reward')::numeric<>(month_row->>'employee_rewards_cents')::numeric or (actual->>'profit')::numeric<>(month_row->>'net_profit_cents')::numeric then raise exception 'Financial reconciliation failed for %',month_row->>'month';end if;
 end loop;
 import_summary:=jsonb_build_object('counts',expected->'counts','monthly_reconciliation','passed','source_sha256',run.source_sha256,'source_snapshot',expected->>'sourceSnapshot','workspace_ids',to_jsonb(wids),'completed_at',now());
 update private.migration_runs set state='complete',completed_at=now(),summary=import_summary where id=import_run;
 return import_summary;
end $$;
revoke all on function private.finalize_original_import(uuid) from public,anon,authenticated;
