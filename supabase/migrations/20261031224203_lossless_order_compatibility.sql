-- Additive compatibility for multi-line/variant orders and lossless historical imports.
alter table public.workspaces add column default_delivery_charge numeric(14,2) not null default 0 check(default_delivery_charge>=0 and default_delivery_charge<>'NaN'::numeric),add column currency text not null default 'MAD',add column source_project text,add column source_order_count integer not null default 0;
alter table public.inventory add column variants jsonb not null default '[]' check(jsonb_typeof(variants)='array'),add column variant_name text not null default 'Color',add column historical_placeholder boolean not null default false;
alter table public.orders add column legacy_settlement_unknown boolean not null default false,add column member_extra_reward numeric(14,2) not null default 0 check(member_extra_reward>=0 and member_extra_reward<>'NaN'::numeric),add column items jsonb not null default '[]' check(jsonb_typeof(items)='array'),add column delivered_at timestamptz,add column payment_status text not null default 'Pay on delivery',add column assigned_to_name text,add column source_project text;
alter table public.team_members drop constraint team_members_reward_trigger_check;
alter table public.team_members add constraint team_members_reward_trigger_check check(reward_trigger in ('new','confirmed','shipped','delivered'));
alter table public.orders drop constraint orders_reward_trigger_check;
alter table public.orders add constraint orders_reward_trigger_check check(reward_trigger in ('new','confirmed','shipped','delivered'));
alter table public.inventory_movements add column source_kind text,add column batch_id uuid,add column details jsonb;
create table public.daily_delivery_costs(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),date date not null,amount numeric(14,2) not null check(amount>=0 and amount<>'NaN'::numeric),created_at timestamptz not null default now(),unique(workspace_id,date));
alter table public.daily_delivery_costs enable row level security;
revoke all on public.daily_delivery_costs from anon,authenticated;
grant select on public.daily_delivery_costs to authenticated;
create policy finance_read on public.daily_delivery_costs for select to authenticated using(private.has_role(workspace_id,array['admin','manager']));
create table private.migration_runs(id uuid primary key default gen_random_uuid(),source_project text not null,source_sha256 text not null unique,imported_at timestamptz not null default now(),owner_id uuid not null references auth.users(id),summary jsonb not null default '{}');
create table private.source_records(run_id uuid not null references private.migration_runs(id),table_name text not null,row_number integer not null,payload jsonb not null,primary key(run_id,table_name,row_number));
revoke all on private.migration_runs,private.source_records from public,anon,authenticated;
alter table private.migration_runs enable row level security;
alter table private.source_records enable row level security;
create index source_records_product_idx on private.source_records((payload->>'product_id'),table_name);
create index orders_items_gin on public.orders using gin(items);

create function private.lines(o public.orders) returns jsonb language sql immutable set search_path='' as $$
select case when jsonb_array_length(o.items)>0 then o.items else jsonb_build_array(jsonb_build_object('itemId',o.item_id,'itemTitle',o.item_title,'quantity',o.quantity,'salePrice',o.sale_price,'unitCost',o.unit_cost,'basePrice',o.base_price)) end $$;
revoke all on function private.lines(public.orders) from public,anon,authenticated;
create function private.stock_signature(lines jsonb) returns jsonb language sql immutable set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('itemId',l->>'itemId','variantId',l->>'variantId','quantity',l->'quantity') order by ord),'[]') from jsonb_array_elements(lines) with ordinality a(l,ord) $$;
revoke all on function private.stock_signature(jsonb) from public,anon,authenticated;
create function private.consume_line(w uuid,pid uuid,qty integer,variant text,oid uuid,line_index integer) returns jsonb language plpgsql set search_path='' as $$
declare p public.inventory;v jsonb;alloc jsonb;
begin
 select * into strict p from public.inventory where id=pid and workspace_id=w for update;
 if jsonb_array_length(p.variants)>0 then
  select x into v from jsonb_array_elements(p.variants) x where x->>'id'=variant;
  if v is null then raise exception 'Choose a variant for %',p.title;end if;
  if (v->>'stock')::integer<qty then raise exception 'Not enough stock for % / % (available %, requested %)',p.title,v->>'label',v->>'stock',qty;end if;
  update public.inventory set variants=(select jsonb_agg(case when x->>'id'=variant then jsonb_set(x,'{stock}',to_jsonb((x->>'stock')::integer-qty)) else x end order by ord) from jsonb_array_elements(p.variants) with ordinality a(x,ord)) where id=pid;
 elsif variant is not null then raise exception 'This variant is unavailable';end if;
 if p.is_bundle and exists(select 1 from jsonb_array_elements(p.bundle_items) c join public.inventory child on child.id=(c->>'itemId')::uuid where jsonb_array_length(child.variants)>0) then raise exception 'Add variant products as separate order items';end if;
 alloc:=private.consume(w,pid,qty,'delivery',oid);
 select jsonb_agg(a||jsonb_build_object('lineIndex',line_index,'variantId',variant)) into alloc from jsonb_array_elements(alloc) a;
 return coalesce(alloc,'[]');
end $$;
revoke all on function private.consume_line(uuid,uuid,integer,text,uuid,integer) from public,anon,authenticated;
alter function private.restore(uuid,jsonb) rename to restore_batches;
create function private.restore(w uuid,alloc jsonb) returns void language plpgsql set search_path='' as $$
declare a jsonb;p public.inventory;
begin
 perform private.restore_batches(w,alloc);
 for a in select value from jsonb_array_elements(alloc) where nullif(value->>'variantId','') is not null loop
  select * into strict p from public.inventory where workspace_id=w and id=(a->>'productId')::uuid for update;
  if not exists(select 1 from jsonb_array_elements(p.variants) v where v->>'id'=a->>'variantId') then raise exception 'Original variant is missing';end if;
  update public.inventory set variants=(select jsonb_agg(case when v->>'id'=a->>'variantId' then jsonb_set(v,'{stock}',to_jsonb((v->>'stock')::integer+(a->>'quantity')::integer)) else v end order by ord) from jsonb_array_elements(p.variants) with ordinality x(v,ord)) where id=p.id;
 end loop;
end $$;
revoke all on function private.restore(uuid,jsonb),private.restore_batches(uuid,jsonb) from public,anon,authenticated;

create or replace function private.save_order(target_workspace uuid,order_id uuid,order_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.orders;n public.orders;p public.inventory;m public.team_members;is_update boolean;was_delivered boolean;is_delivered boolean;changed boolean;raw_lines jsonb;clean jsonb:='[]';l jsonb;prior jsonb;alloc jsonb;line_cost numeric;cost_sum numeric:=0;rev numeric:=0;base_sum numeric:=0;extra numeric:=0;q integer;idx integer:=0;total_qty integer:=0;eligible boolean;price_unchanged boolean;set_clause text;v jsonb;
begin
 perform private.require_role(target_workspace,array['admin','manager','staff']);
 select * into old from public.orders where id=order_id for update;is_update:=found;
 if is_update and old.workspace_id<>target_workspace then raise exception 'Order not found';end if;
 n:=jsonb_populate_record(null::public.orders,case when is_update then to_jsonb(old) else '{}'::jsonb end||order_data);
 n.id:=order_id;n.workspace_id:=target_workspace;n.created_at:=case when is_update then old.created_at else now() end;n.created_by:=case when is_update then old.created_by else auth.uid() end;n.source_project:=case when is_update then old.source_project end;n.legacy_settlement_unknown:=case when is_update then old.legacy_settlement_unknown else false end;
 n.status:=coalesce(n.status,'new');n.date:=coalesce(case when is_update then old.date else n.date end,(now() at time zone 'Africa/Casablanca')::date);n.buyer_name:=coalesce(n.buyer_name,'');n.shipping_cost:=coalesce(n.shipping_cost,0);n.shipping_charged:=coalesce(n.shipping_charged,0);n.platform_fee:=coalesce(n.platform_fee,0);n.payment_method:=coalesce(n.payment_method,'cash');n.payment_status:=coalesce(n.payment_status,'Pay on delivery');n.fulfillment_type:=coalesce(n.fulfillment_type,'local_pickup');
 raw_lines:=case when order_data ? 'items' and jsonb_array_length(order_data->'items')>0 then order_data->'items' else jsonb_build_array(jsonb_build_object('itemId',n.item_id,'itemTitle',n.item_title,'quantity',coalesce(n.quantity,1),'salePrice',n.sale_price,'unitCost',coalesce(n.unit_cost,0))) end;
 if jsonb_array_length(raw_lines)>100 then raise exception 'At most 100 lines per order';end if;
 was_delivered:=is_update and old.status in ('delivered','completed');is_delivered:=n.status in ('delivered','completed');
 changed:=not is_update or private.stock_signature(raw_lines) is distinct from private.stock_signature(private.lines(old)) or was_delivered is distinct from is_delivered;
 if was_delivered and changed then
  if old.source_project is not null and jsonb_array_length(old.stock_allocations)=0 and exists(select 1 from jsonb_array_elements(private.lines(old)) x where nullif(x->>'itemId','') is not null) then raise exception 'Historical stock allocations are unavailable. This order cannot change its delivered stock state.';end if;
  perform private.restore(target_workspace,old.stock_allocations);
 end if;
 n.stock_allocations:=case when is_delivered and not changed then old.stock_allocations else '[]'::jsonb end;
 for l in select value from jsonb_array_elements(raw_lines) loop
  q:=(l->>'quantity')::integer;
  if q is null or q<=0 or l->>'salePrice' is null or (l->>'salePrice')::numeric<0 then raise exception 'Invalid line quantity or price';end if;
  prior:=case when is_update then private.lines(old)->idx end;
  if nullif(l->>'itemId','') is not null then
   select * into strict p from public.inventory where id=(l->>'itemId')::uuid and workspace_id=target_workspace;
   if p.status='archived' and (not is_update or not exists(select 1 from jsonb_array_elements(private.lines(old)) x where x->>'itemId'=p.id::text)) then raise exception 'Product is archived';end if;
   v:=null;
   if jsonb_array_length(p.variants)>0 then
    select x into v from jsonb_array_elements(p.variants) x where x->>'id'=l->>'variantId';
    if v is null and not (was_delivered and not changed) then raise exception 'Choose an available variant for %',p.title;end if;
   end if;
   l:=l||jsonb_build_object('itemTitle',p.title,'basePrice',p.selling_price,'unitCost',p.cost_price,'variantLabel',coalesce(v->>'label',l->>'variantLabel'),'variantName',p.variant_name);
   if is_delivered and changed then
    alloc:=private.consume_line(target_workspace,p.id,q,nullif(l->>'variantId',''),order_id,idx);
    n.stock_allocations:=n.stock_allocations||alloc;
    select coalesce(sum((a->>'quantity')::numeric*(a->>'costPrice')::numeric),0)/q into line_cost from jsonb_array_elements(alloc) a;
    l:=l||jsonb_build_object('unitCost',line_cost);
   elsif was_delivered and not changed then
    l:=l||jsonb_build_object('unitCost',coalesce((prior->>'unitCost')::numeric,old.unit_cost),'basePrice',coalesce((prior->>'basePrice')::numeric,old.base_price,p.selling_price));
   end if;
  else
   l:=l||jsonb_build_object('unitCost',coalesce((l->>'unitCost')::numeric,0),'basePrice',(l->>'salePrice')::numeric);
  end if;
  if coalesce(l->>'itemTitle','')='' then raise exception 'Enter a product name';end if;
  clean:=clean||jsonb_build_array(jsonb_build_object('itemId',nullif(l->>'itemId',''),'itemTitle',l->>'itemTitle','quantity',q,'salePrice',(l->>'salePrice')::numeric,'unitCost',(l->>'unitCost')::numeric,'costTotal',case when was_delivered and not changed and prior->>'costTotal' is not null then (prior->>'costTotal')::numeric else round((l->>'unitCost')::numeric*q,2) end,'basePrice',(l->>'basePrice')::numeric,'variantId',nullif(l->>'variantId',''),'variantLabel',l->>'variantLabel','variantName',l->>'variantName'));
  rev:=rev+(l->>'salePrice')::numeric*q;cost_sum:=cost_sum+case when was_delivered and not changed and prior->>'costTotal' is not null then (prior->>'costTotal')::numeric else (l->>'unitCost')::numeric*q end;base_sum:=base_sum+(l->>'basePrice')::numeric*q;extra:=extra+greatest((l->>'salePrice')::numeric-(l->>'basePrice')::numeric,0)*q;
  total_qty:=total_qty+q;idx:=idx+1;
 end loop;
 n.items:=clean;n.item_id:=nullif(clean->0->>'itemId','')::uuid;n.item_title:=(select string_agg((x->>'itemTitle')||case when nullif(x->>'variantLabel','') is not null then ' · '||(x->>'variantLabel') else '' end,' + ' order by ord) from jsonb_array_elements(clean) with ordinality a(x,ord));n.quantity:=total_qty;n.unit_cost:=round(cost_sum/total_qty,4);n.sale_price:=round(rev/total_qty,2);n.base_price:=round(base_sum/total_qty,2);
 n.member_reward:=0;n.member_extra_reward:=0;n.reward_status:=case when n.status='cancelled' then 'cancelled' else 'pending' end;n.confirmation_member_name:=null;n.reward_trigger:=null;n.reward_calculation_mode:=null;
 if n.confirmation_member_id is not null then
  select * into strict m from public.team_members where workspace_id=target_workspace and id=n.confirmation_member_id;
  n.confirmation_member_name:=m.name;n.reward_trigger:=m.reward_trigger;n.reward_calculation_mode:=m.reward_calculation_mode;
  eligible:=n.status<>'cancelled' and case m.reward_trigger when 'new' then true when 'confirmed' then n.status in ('confirmed','pending_pickup','shipped','delivered','completed') when 'shipped' then n.status in ('shipped','delivered','completed') else is_delivered end;
  if eligible then
   n.reward_status:='granted';n.member_extra_reward:=round(extra,2);
   price_unchanged:=is_update and (select jsonb_agg(jsonb_build_array(x->'itemId',x->'quantity',x->'salePrice') order by ord) from jsonb_array_elements(clean) with ordinality a(x,ord)) is not distinct from (select jsonb_agg(jsonb_build_array(x->'itemId',x->'quantity',x->'salePrice') order by ord) from jsonb_array_elements(private.lines(old)) with ordinality a(x,ord));
   if old.reward_status='granted' and old.confirmation_member_id=n.confirmation_member_id and price_unchanged then n.member_reward:=old.member_reward;n.member_extra_reward:=old.member_extra_reward;n.base_price:=old.base_price;
   else n.member_reward:=round(m.base_reward*case when m.reward_calculation_mode='per_item' then total_qty else 1 end+extra,2);end if;
  end if;
 end if;
 n.total_revenue:=round(rev+n.shipping_charged,2);n.total_cost:=round(cost_sum+n.shipping_cost+n.platform_fee,2);n.net_profit:=case when n.status='cancelled' then 0 else n.total_revenue-n.total_cost-n.member_reward end;n.profit_margin:=case when n.total_revenue>0 then round(n.net_profit/n.total_revenue*100,4) else 0 end;
 if is_delivered then n.delivered_date:=coalesce(n.delivered_date,old.delivered_date,(now() at time zone 'Africa/Casablanca')::date);n.delivered_at:=coalesce(case when was_delivered then old.delivered_at end,n.delivered_at,now());else n.delivered_date:=null;n.delivered_at:=null;end if;
 if is_update then
  select string_agg(format('%1$I=($1).%1$I',column_name),',') into set_clause from information_schema.columns where table_schema='public' and table_name='orders' and column_name not in ('id','workspace_id','created_at','created_by','source_project');
  execute 'update public.orders set '||set_clause||' where id=$2 and workspace_id=$3' using n,n.id,target_workspace;
 else insert into public.orders select n.*;end if;
 perform private.refresh_bundles(target_workspace);return order_id;
end $$;

create or replace function private.refresh_pending_order_prices() returns trigger language plpgsql set search_path='' as $$
declare o public.orders;begin
 for o in select * from public.orders where workspace_id=new.workspace_id and status in ('new','confirmed','pending_pickup','shipped') and (item_id=new.id or items @> jsonb_build_array(jsonb_build_object('itemId',new.id))) order by id loop
  perform private.save_order(new.workspace_id,o.id,to_jsonb(o)||jsonb_build_object('items',private.lines(o)));
 end loop;return new;
end $$;

alter function private.restock_inventory(uuid,uuid,jsonb) rename to restock_batches;
create function private.restock_inventory(target_workspace uuid,product_id uuid,lot jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.inventory;v jsonb;begin
 perform private.require_role(target_workspace,array['admin','manager','staff']);
 select * into strict p from public.inventory where id=product_id and workspace_id=target_workspace for update;
 if jsonb_array_length(p.variants)>0 then
  select x into v from jsonb_array_elements(p.variants) x where x->>'id'=lot->>'variant_id';
  if v is null then raise exception 'Choose a variant to restock';end if;
  if coalesce((lot->>'quantity')::integer,0)<=0 then raise exception 'Invalid restock';end if;
  update public.inventory set variants=(select jsonb_agg(case when x->>'id'=lot->>'variant_id' then jsonb_set(x,'{stock}',to_jsonb((x->>'stock')::integer+(lot->>'quantity')::integer)) else x end order by ord) from jsonb_array_elements(p.variants) with ordinality a(x,ord)) where id=p.id;
 end if;
 return private.restock_batches(target_workspace,product_id,lot);
end $$;
revoke all on function private.restock_batches(uuid,uuid,jsonb),private.restock_inventory(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.restock_inventory(uuid,uuid,jsonb) to authenticated;

create function private.save_daily_delivery_cost(target_workspace uuid,cost_date date,cost_amount numeric) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_role(target_workspace,array['admin','manager']);if cost_date is null or cost_amount is null or cost_amount<0 or cost_amount='NaN'::numeric then raise exception 'Enter a valid date and delivery cost';end if;
insert into public.daily_delivery_costs(workspace_id,date,amount) values(target_workspace,cost_date,cost_amount) on conflict(workspace_id,date) do update set amount=excluded.amount;end $$;
create function public.save_daily_delivery_cost(target_workspace uuid,cost_date date,cost_amount numeric) returns void language sql security invoker set search_path='' as $$select private.save_daily_delivery_cost(target_workspace,cost_date,cost_amount)$$;
revoke all on function private.save_daily_delivery_cost(uuid,date,numeric),public.save_daily_delivery_cost(uuid,date,numeric) from public,anon;
grant execute on function private.save_daily_delivery_cost(uuid,date,numeric),public.save_daily_delivery_cost(uuid,date,numeric) to authenticated;
create function private.save_workspace_settings(target_workspace uuid,delivery_default numeric) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_role(target_workspace,array['admin','manager']);update public.workspaces set default_delivery_charge=delivery_default where id=target_workspace;end $$;
create function public.save_workspace_settings(target_workspace uuid,delivery_default numeric) returns void language sql security invoker set search_path='' as $$select private.save_workspace_settings(target_workspace,delivery_default)$$;
revoke all on function private.save_workspace_settings(uuid,numeric),public.save_workspace_settings(uuid,numeric) from public,anon;
grant execute on function private.save_workspace_settings(uuid,numeric),public.save_workspace_settings(uuid,numeric) to authenticated;
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.daily_delivery_costs;end if;end$$;

create function private.save_inventory_metadata(target_workspace uuid,product_id uuid,product jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.inventory;old public.inventory;part jsonb;exists_before boolean;begin
 perform private.require_role(target_workspace,array['admin','manager','staff']);
 select * into old from public.inventory where id=product_id for update;exists_before:=found;if exists_before and old.workspace_id<>target_workspace then raise exception 'Product not found';end if;
 p:=jsonb_populate_record(null::public.inventory,coalesce(to_jsonb(old),'{}')||product);p.id:=product_id;p.workspace_id:=target_workspace;p.title:=trim(p.title);p.category:=coalesce(p.category,'Other');p.condition:=coalesce(p.condition,'new');p.cost_price:=coalesce(p.cost_price,0);p.selling_price:=coalesce(p.selling_price,0);p.stock:=coalesce(p.stock,0);p.low_stock_threshold:=coalesce(p.low_stock_threshold,2);p.status:=coalesce(p.status,'active');p.fulfillment_type:=coalesce(p.fulfillment_type,'both');p.variants:=coalesce(p.variants,'[]');p.variant_name:=coalesce(p.variant_name,'Color');p.historical_placeholder:=coalesce(old.historical_placeholder,false);p.is_bundle:=coalesce(p.is_bundle,false);p.bundle_items:=coalesce(p.bundle_items,'[]');p.batches:=coalesce(p.batches,'[]');p.created_at:=case when exists_before then old.created_at else now() end;p.updated_at:=now();p.created_by:=case when exists_before then old.created_by else auth.uid() end;
 if exists_before then if p.is_bundle<>old.is_bundle then raise exception 'Cannot change product kind';end if;if not p.is_bundle and p.stock<>old.stock then raise exception 'Use restock or stock adjustment to change existing stock';end if;p.batches:=old.batches;end if;
 if p.is_bundle then
 if jsonb_array_length(p.bundle_items)=0 then raise exception 'Add bundle components';end if;
 for part in select value from jsonb_array_elements(p.bundle_items) loop
 if coalesce((part->>'quantity')::integer,0)<=0 or not exists(select 1 from public.inventory where workspace_id=target_workspace and id=(part->>'itemId')::uuid and not is_bundle and status<>'archived') then raise exception 'Invalid bundle component';end if;end loop;
 p.stock:=0;p.batches:='[]';
 elsif not exists_before then p.batches:=case when p.stock>0 then jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'batchNumber',1,'receivedDate',(now() at time zone 'Africa/Casablanca')::date,'initialQty',p.stock,'remainingQty',p.stock,'costPrice',p.cost_price,'sellingPrice',p.selling_price,'createdAt',now())) else '[]' end;end if;
 insert into public.inventory select p.* on conflict(id) do update set title=excluded.title,sku=excluded.sku,category=excluded.category,condition=excluded.condition,cost_price=excluded.cost_price,selling_price=excluded.selling_price,low_stock_threshold=excluded.low_stock_threshold,vendor_id=excluded.vendor_id,vendor_name=excluded.vendor_name,listing_url=excluded.listing_url,status=excluded.status,fulfillment_type=excluded.fulfillment_type,notes=excluded.notes,bundle_items=excluded.bundle_items,variants=excluded.variants,variant_name=excluded.variant_name,updated_at=excluded.updated_at;
 perform private.refresh_bundles(target_workspace);return product_id;end $$;

create or replace function private.read_workspace_records(target_workspace uuid,table_name text,page_offset integer default 0,page_size integer default 500,entity_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare records jsonb;total bigint;financial boolean;begin
 if not private.has_role(target_workspace) then raise exception 'Approved workspace access required' using errcode='42501';end if;
 if table_name not in ('inventory','orders','vendors','team_members','team_payouts','daily_delivery_costs') or page_offset<0 or page_size<1 or page_size>500 then raise exception 'Invalid read request';end if;
 financial:=private.has_role(target_workspace,array['admin','manager']);
 if not financial and table_name in ('vendors','team_payouts','daily_delivery_costs') then return jsonb_build_object('rows','[]'::jsonb,'total',0);end if;
 execute format('select count(*) from public.%I where workspace_id=$1 and ($2 is null or id=$2)',table_name) into total using target_workspace,entity_id;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select * from public.%I where workspace_id=$1 and ($2 is null or id=$2) order by id limit $3 offset $4) r',table_name) into records using target_workspace,entity_id,page_size,page_offset;
 if not financial then
 if table_name='inventory' then select coalesce(jsonb_agg(r||jsonb_build_object('cost_price',0,'batches','[]'::jsonb,'bundle_items','[]'::jsonb)),'[]'::jsonb) into records from jsonb_array_elements(records) r;
 elsif table_name='orders' then select coalesce(jsonb_agg(r||jsonb_build_object('unit_cost',0,'total_cost',0,'net_profit',0,'profit_margin',0,'member_reward',0,'member_extra_reward',0,'base_price',0,'stock_allocations','[]'::jsonb,'items',coalesce((select jsonb_agg(l||jsonb_build_object('unitCost',0,'basePrice',0,'costTotal',0)) from jsonb_array_elements(r->'items') l),'[]'::jsonb))),'[]'::jsonb) into records from jsonb_array_elements(records) r;
 elsif table_name='team_members' then select coalesce(jsonb_agg(r||jsonb_build_object('base_reward',0,'total_paid',0)),'[]'::jsonb) into records from jsonb_array_elements(records) r;end if;end if;
 return jsonb_build_object('rows',records,'total',total);end $$;

create or replace function private.save_inventory(target_workspace uuid,product_id uuid,product jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.inventory;requested jsonb;base_variants jsonb:='[]';v jsonb;prior jsonb;delta integer;existing boolean;payload jsonb;stock_total integer:=0;
begin
 perform private.require_role(target_workspace,array['admin','manager','staff']);
 select * into old from public.inventory where id=product_id for update;existing:=found;
 if existing and old.workspace_id<>target_workspace then raise exception 'Product not found';end if;
 requested:=coalesce(product->'variants',old.variants,'[]');
 if jsonb_typeof(requested) is distinct from 'array' then raise exception 'Invalid variants';end if;
 if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(requested) x) then raise exception 'Variant IDs must be unique';end if;
 for v in select value from jsonb_array_elements(requested) loop
  perform (v->>'id')::uuid;
  if nullif(trim(v->>'label'),'') is null or (v->>'stock')::integer<0 or v->>'stock' is null then raise exception 'Enter variant names and valid stock counts';end if;
  stock_total:=stock_total+(v->>'stock')::integer;
  select x into prior from jsonb_array_elements(coalesce(old.variants,'[]')) x where x->>'id'=v->>'id';
  base_variants:=base_variants||jsonb_build_array(jsonb_build_object('id',v->>'id','label',trim(v->>'label'),'stock',case when existing then coalesce((prior->>'stock')::integer,0) else (v->>'stock')::integer end));
 end loop;
 if existing then
  for prior in select value from jsonb_array_elements(old.variants) loop
   if not exists(select 1 from jsonb_array_elements(requested) v where v->>'id'=prior->>'id') and ((prior->>'stock')::integer>0 or exists(select 1 from public.orders o where o.workspace_id=target_workspace and o.status<>'cancelled' and o.items @> jsonb_build_array(jsonb_build_object('itemId',product_id,'variantId',prior->>'id')))) then raise exception 'Keep variants with stock or open orders';end if;
  end loop;
  if jsonb_array_length(old.variants)=0 and old.stock>0 and jsonb_array_length(requested)>0 then if stock_total<>old.stock then raise exception 'Distribute the existing % units across variants',old.stock;end if;base_variants:=requested;end if;
  if jsonb_array_length(old.variants)>0 and jsonb_array_length(requested)=0 then raise exception 'Keep the existing variants';end if;
 end if;
 payload:=product||jsonb_build_object('variants',base_variants);
 if existing and not private.has_role(target_workspace,array['admin','manager']) then payload:=payload||jsonb_build_object('cost_price',old.cost_price);end if;
 if jsonb_array_length(requested)>0 then
  if coalesce((product->>'is_bundle')::boolean,old.is_bundle,false) then raise exception 'Bundle components must manage their own variants';end if;
  payload:=payload||jsonb_build_object('stock',case when existing then old.stock else stock_total end);
 end if;
 perform private.save_inventory_metadata(target_workspace,product_id,payload);
 if existing then
  for v in select value from jsonb_array_elements(requested) loop
   select x into prior from jsonb_array_elements(base_variants) x where x->>'id'=v->>'id';
   delta:=(v->>'stock')::integer-(prior->>'stock')::integer;
   if delta<>0 and not private.has_role(target_workspace,array['admin','manager']) then raise exception 'Manager access required for stock adjustments';end if;
   if delta>0 then perform private.restock_inventory(target_workspace,product_id,jsonb_build_object('quantity',delta,'cost_price',coalesce((product->>'cost_price')::numeric,old.cost_price),'selling_price',coalesce((product->>'selling_price')::numeric,old.selling_price),'variant_id',v->>'id','notes','Variant stock adjustment'));
   elsif delta<0 then
    perform private.consume_line(target_workspace,product_id,-delta,v->>'id',null,0);
    update public.inventory_movements set kind='correction',source_kind='variant correction' where workspace_id=target_workspace and public.inventory_movements.product_id=save_inventory.product_id and created_at=now() and order_id is null;
   end if;
  end loop;
 end if;
 perform private.refresh_bundles(target_workspace);return product_id;
end $$;
revoke all on function private.save_inventory_metadata(uuid,uuid,jsonb) from public,anon,authenticated;
create or replace function public.restock_inventory(target_workspace uuid,product_id uuid,lot jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.restock_inventory(target_workspace,product_id,lot)$$;

create function private.inventory_history(target_workspace uuid,product_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(target_workspace,array['admin','manager']) then raise exception 'Financial access required' using errcode='42501';end if;
 if not exists(select 1 from public.inventory where id=product_id and workspace_id=target_workspace) then raise exception 'Product not found';end if;
 return jsonb_build_object('movements',(select coalesce(jsonb_agg(to_jsonb(m) order by created_at desc),'[]') from public.inventory_movements m where workspace_id=target_workspace and m.product_id=inventory_history.product_id),
 'corrections',(select coalesce(jsonb_agg(payload order by payload->>'created_at' desc),'[]') from private.source_records where table_name='inventory_corrections' and payload->>'product_id'=product_id::text and payload->>'workspace_id'=target_workspace::text));
end $$;
create function public.inventory_history(target_workspace uuid,product_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.inventory_history(target_workspace,product_id)$$;
revoke all on function private.inventory_history(uuid,uuid),public.inventory_history(uuid,uuid) from public,anon;
grant execute on function private.inventory_history(uuid,uuid),public.inventory_history(uuid,uuid) to authenticated;

-- Prevent legacy metadata APIs from ignoring variant stock.
alter function private.adjust_stock(uuid,uuid,integer) rename to adjust_stock_batches;
create function private.adjust_stock(target_workspace uuid,product_id uuid,delta integer) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_role(target_workspace,array['admin','manager']);
if exists(select 1 from public.inventory where id=product_id and workspace_id=target_workspace and jsonb_array_length(variants)>0) then raise exception 'Adjust each variant in the product editor, or select a variant when restocking';end if;
perform private.adjust_stock_batches(target_workspace,product_id,delta);end$$;
create or replace function public.adjust_stock(target_workspace uuid,product_id uuid,delta integer) returns void language sql security invoker set search_path='' as $$select private.adjust_stock(target_workspace,product_id,delta)$$;
revoke all on function private.adjust_stock_batches(uuid,uuid,integer),private.adjust_stock(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function private.adjust_stock(uuid,uuid,integer) to authenticated;

create or replace function private.delete_inventory(target_workspace uuid,product_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin perform private.require_role(target_workspace,array['admin','manager']);if exists(select 1 from public.orders where workspace_id=target_workspace and (item_id=product_id or items @> jsonb_build_array(jsonb_build_object('itemId',product_id)))) or exists(select 1 from public.inventory b,jsonb_array_elements(b.bundle_items) part where b.workspace_id=target_workspace and part->>'itemId'=product_id::text) then raise exception 'This product has history or belongs to a bundle. Archive it instead.';end if;delete from public.inventory_movements where workspace_id=target_workspace and public.inventory_movements.product_id=delete_inventory.product_id;delete from public.inventory where workspace_id=target_workspace and id=product_id;end $$;

create or replace function private.record_payout(target_workspace uuid,payout_id uuid,payout jsonb) returns uuid language plpgsql security definer set search_path='' as $$ declare n public.team_payouts;old public.team_payouts;m public.team_members;earned numeric;paid numeric;begin
 perform private.require_role(target_workspace,array['admin','manager']);n:=jsonb_populate_record(null::public.team_payouts,payout);
 select * into old from public.team_payouts where id=payout_id;if found then if old.workspace_id=target_workspace and old.member_id=n.member_id and old.amount=n.amount then return payout_id;else raise exception 'Payout request conflicts with existing record';end if;end if;
 select * into strict m from public.team_members where workspace_id=target_workspace and id=n.member_id for update;
 select coalesce(sum(member_reward),0) into earned from public.orders where workspace_id=target_workspace and confirmation_member_id=m.id and reward_status='granted' and not legacy_settlement_unknown and status<>'cancelled';select coalesce(sum(amount),0) into paid from public.team_payouts where workspace_id=target_workspace and member_id=m.id;
 if n.amount is null or n.amount<=0 or n.amount>earned-paid then raise exception 'Payout exceeds earned unpaid rewards';end if;
 n.id:=payout_id;n.workspace_id:=target_workspace;n.member_name:=m.name;n.date:=coalesce(n.date,(now() at time zone 'Africa/Casablanca')::date);n.created_at:=now();n.created_by:=auth.uid();n.payment_method:=coalesce(n.payment_method,'cash');insert into public.team_payouts select n.*;update public.team_members set total_paid=paid+n.amount where id=m.id;return payout_id;end $$;
