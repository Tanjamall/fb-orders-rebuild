-- Distinguish the requested-variant query value from the PL/pgSQL loop variable.
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
   if not exists(select 1 from jsonb_array_elements(requested) as requested_variant(value) where requested_variant.value->>'id'=prior->>'id') and ((prior->>'stock')::integer>0 or exists(select 1 from public.orders o where o.workspace_id=target_workspace and o.status<>'cancelled' and o.items @> jsonb_build_array(jsonb_build_object('itemId',product_id,'variantId',prior->>'id')))) then raise exception 'Keep variants with stock or open orders';end if;
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
