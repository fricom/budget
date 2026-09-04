create or replace function complete_onboarding()
returns households
language plpgsql
security definer
set search_path = public
as $$
declare v_household households;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select h.* into v_household from households h
  join household_members hm on hm.household_id = h.id
  where hm.user_id = auth.uid() order by hm.created_at limit 1;
  if v_household is null then raise exception 'household membership required'; end if;
  if v_household.onboarding_completed_at is not null then return v_household; end if;
  if v_household.created_by <> auth.uid() then raise exception 'household creator must finish onboarding'; end if;
  update households h set onboarding_step='complete',onboarding_completed_at=coalesce(h.onboarding_completed_at,now())
  where h.id=v_household.id returning h.* into v_household;
  return v_household;
end;
$$;
grant execute on function complete_onboarding() to authenticated;
