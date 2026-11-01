-- Derive bundle cost and stock from its components; bundles are not additional inventory assets.
create or replace function private.refresh_bundles(w uuid) returns void language sql set search_path='' as $$
with estimates as (
 select b.id,coalesce(min(p.stock/(part->>'quantity')::integer),0) as available,coalesce(sum(p.cost_price*(part->>'quantity')::integer),0) as component_cost
 from public.inventory b cross join lateral jsonb_array_elements(b.bundle_items) part join public.inventory p on p.id=(part->>'itemId')::uuid and p.workspace_id=w where b.workspace_id=w and b.is_bundle group by b.id
) update public.inventory b set stock=e.available,cost_price=e.component_cost,updated_at=now() from estimates e where b.id=e.id and (b.stock,b.cost_price) is distinct from (e.available,e.component_cost)
$$;
revoke all on function private.refresh_bundles(uuid) from public,anon,authenticated;
do $$declare w uuid;begin for w in select id from public.workspaces loop perform private.refresh_bundles(w);end loop;end$$;
