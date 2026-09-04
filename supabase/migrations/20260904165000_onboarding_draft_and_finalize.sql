alter table households add column if not exists onboarding_data jsonb not null default '{}'::jsonb;
comment on column households.onboarding_data is '완료 전 단계별 입력 초안. 최종 확정 후에도 재개 감사용으로 유지.';

create or replace function save_onboarding_progress(p_step text, p_data jsonb)
returns households language plpgsql security definer set search_path = public as $$
declare v_household households;
begin
  update households h set onboarding_step = p_step, onboarding_data = h.onboarding_data || coalesce(p_data, '{}'::jsonb)
  where h.created_by = auth.uid() and h.onboarding_completed_at is null returning h.* into v_household;
  if v_household is null then raise exception 'incomplete household required'; end if;
  return v_household;
end; $$;
grant execute on function save_onboarding_progress(text, jsonb) to authenticated;

create or replace function finalize_onboarding(p_data jsonb)
returns households language plpgsql security definer set search_path = public as $$
declare
  v_household households; v_household_id uuid; v_month date := date_trunc('month', current_date)::date;
  v_income_1 numeric := coalesce((p_data->>'income_1')::numeric, 0);
  v_income_2 numeric := coalesce((p_data->>'income_2')::numeric, 0); v_income_total numeric;
begin
  select h.id into v_household_id from households h
  where h.created_by = auth.uid() and h.onboarding_completed_at is null order by h.created_at limit 1;
  if v_household_id is null then raise exception 'incomplete household required'; end if;
  update household_members set monthly_income = v_income_1 where household_id = v_household_id and position = 1;
  update household_members set monthly_income = v_income_2 where household_id = v_household_id and position = 2;
  v_income_total := v_income_1 + v_income_2;
  update household_members set allowance_ratio = case
    when position = 1 and v_income_2 = 0 then 1
    when position = 1 and v_income_total > 0 then round(v_income_1 / v_income_total, 3)
    when position = 2 and v_income_total > 0 then 1 - round(v_income_1 / v_income_total, 3)
    else null end where household_id = v_household_id and position in (1, 2);
  insert into fixed_costs (household_id, effective_from, loan_payment, housing_fee, telecom_fee, property_tax_monthly, insurance_total)
  values (v_household_id, v_month, coalesce((p_data->>'loan_payment')::numeric, 0), coalesce((p_data->>'housing_fee')::numeric, 0), coalesce((p_data->>'telecom_fee')::numeric, 0), coalesce((p_data->>'property_tax_monthly')::numeric, 0), coalesce((p_data->>'insurance_total')::numeric, 0))
  on conflict (household_id, effective_from) do update set loan_payment=excluded.loan_payment,housing_fee=excluded.housing_fee,telecom_fee=excluded.telecom_fee,property_tax_monthly=excluded.property_tax_monthly,insurance_total=excluded.insurance_total;
  insert into goals (household_id, category, target_amount, effective_from)
  select v_household_id,x.category,x.amount,v_month from (values
    ('living',coalesce((p_data->>'living')::numeric,0)),('savings',coalesce((p_data->>'savings')::numeric,0)),('pension',coalesce((p_data->>'pension')::numeric,0)),('emergency',coalesce((p_data->>'emergency')::numeric,0)),('allowance',coalesce((p_data->>'allowance')::numeric,0))) as x(category,amount)
  on conflict (household_id,category,effective_from) do update set target_amount=excluded.target_amount;
  update households h set onboarding_step='complete',onboarding_data=h.onboarding_data||p_data,onboarding_completed_at=now()
  where h.id=v_household_id returning h.* into v_household;
  return v_household;
end; $$;
grant execute on function finalize_onboarding(jsonb) to authenticated;
