-- Refresh waiting-order projections whenever the active catalog prices change.
-- Customer sale prices stay agreed; delivered/completed/cancelled history is excluded.
create function private.refresh_pending_order_prices() returns trigger
language plpgsql set search_path='' as $$
declare waiting_order public.orders;
begin
 for waiting_order in
   select * from public.orders
   where workspace_id=new.workspace_id and item_id=new.id
     and status in ('new','confirmed','pending_pickup','shipped')
   order by id
 loop
   perform private.save_order(new.workspace_id,waiting_order.id,to_jsonb(waiting_order));
 end loop;
 return new;
end $$;
revoke all on function private.refresh_pending_order_prices() from public,anon,authenticated;
create trigger refresh_pending_order_prices
after update of cost_price,selling_price on public.inventory
for each row
when (old.cost_price is distinct from new.cost_price or old.selling_price is distinct from new.selling_price)
execute function private.refresh_pending_order_prices();
