-- 가구 생성/가입 관련 RPC 함수
-- schema.sql의 households/household_members RLS는 "이미 그 가구의 멤버"를 전제로 하기 때문에,
-- 최초 가구 생성과 초대코드로 첫 가입하는 순간에는 RLS를 통과할 방법이 없음(닭-달걀 문제).
-- 아래 함수들은 SECURITY DEFINER로 이 문제를 우회함 (Supabase에서 postgres 소유 함수는 RLS를 bypass).

-- 온보딩 "가구원 등록" 1단계: 가구 생성 + 생성자를 position 1 가구원으로 등록
create or replace function create_household(p_household_name text, p_member_name text)
returns household_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_member household_members;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into households (name, created_by)
  values (p_household_name, auth.uid())
  returning id into v_household_id;

  insert into household_members (household_id, position, name, user_id)
  values (v_household_id, 1, p_member_name, auth.uid())
  returning * into v_member;

  return v_member;
end;
$$;

grant execute on function create_household(text, text) to authenticated;

-- 초대코드로 들어온 사람이 로그인 전에 "이 가구가 맞는지 + 누구 슬롯이 비어있는지" 미리보기
-- (아직 멤버가 아니므로 일반 RLS로는 households/household_members를 못 읽음)
create or replace function get_invite_preview(p_invite_code text)
returns table (
  household_name text,
  member_id uuid,
  member_position smallint,
  member_name text,
  is_claimed boolean
)
language sql
security definer
set search_path = public
as $$
  select h.name, hm.id, hm.position, hm.name, (hm.user_id is not null)
  from households h
  join household_members hm on hm.household_id = h.id
  where h.invite_code = p_invite_code
  order by hm.position;
$$;

grant execute on function get_invite_preview(text) to anon, authenticated;

-- 초대코드 + 선택한 가구원 슬롯으로 가입 (해당 슬롯이 아직 비어있을 때만 성공)
create or replace function join_household(p_invite_code text, p_member_id uuid)
returns household_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_member household_members;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select id into v_household_id from households where invite_code = p_invite_code;
  if v_household_id is null then
    raise exception 'invalid invite code';
  end if;

  update household_members
  set user_id = auth.uid()
  where id = p_member_id
    and household_id = v_household_id
    and user_id is null
  returning * into v_member;

  if v_member is null then
    raise exception 'slot not available';
  end if;

  return v_member;
end;
$$;

grant execute on function join_household(text, uuid) to authenticated;

-- 온보딩 최종 CTA에서만 호출. 단순히 가구원 행이 생긴 것과 설정 완료를 구분한다.
create or replace function complete_onboarding()
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household households;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select h.* into v_household
  from households h
  join household_members hm on hm.household_id = h.id
  where hm.user_id = auth.uid()
  order by hm.created_at
  limit 1;

  if v_household is null then raise exception 'household membership required'; end if;
  if v_household.onboarding_completed_at is not null then return v_household; end if;
  if v_household.created_by <> auth.uid() then raise exception 'household creator must finish onboarding'; end if;

  update households h
  set onboarding_step = 'complete',
      onboarding_completed_at = coalesce(h.onboarding_completed_at, now())
  where h.id = v_household.id
  returning h.* into v_household;
  return v_household;
end;
$$;

grant execute on function complete_onboarding() to authenticated;

create or replace function save_onboarding_progress(p_step text, p_data jsonb)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household households;
begin
  update households h
  set onboarding_step = p_step,
      onboarding_data = h.onboarding_data || coalesce(p_data, '{}'::jsonb)
  where h.created_by = auth.uid()
    and h.onboarding_completed_at is null
  returning h.* into v_household;

  if v_household is null then raise exception 'incomplete household required'; end if;
  return v_household;
end;
$$;

grant execute on function save_onboarding_progress(text, jsonb) to authenticated;

create or replace function finalize_onboarding(p_data jsonb)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household households;
  v_household_id uuid;
  v_month date := date_trunc('month', current_date)::date;
  v_income_1 numeric := coalesce((p_data->>'income_1')::numeric, 0);
  v_income_2 numeric := coalesce((p_data->>'income_2')::numeric, 0);
  v_income_total numeric;
begin
  select h.id into v_household_id
  from households h
  where h.created_by = auth.uid() and h.onboarding_completed_at is null
  order by h.created_at limit 1;
  if v_household_id is null then raise exception 'incomplete household required'; end if;

  update household_members set monthly_income = v_income_1
  where household_id = v_household_id and position = 1;
  update household_members set monthly_income = v_income_2
  where household_id = v_household_id and position = 2;

  v_income_total := v_income_1 + v_income_2;
  update household_members
  set allowance_ratio = case
    when position = 1 and v_income_2 = 0 then 1
    when position = 1 and v_income_total > 0 then round(v_income_1 / v_income_total, 3)
    when position = 2 and v_income_total > 0 then 1 - round(v_income_1 / v_income_total, 3)
    else null end
  where household_id = v_household_id and position in (1, 2);

  insert into fixed_costs (household_id, effective_from, loan_payment, housing_fee, telecom_fee, property_tax_monthly, insurance_total)
  values (v_household_id, v_month,
    coalesce((p_data->>'loan_payment')::numeric, 0), coalesce((p_data->>'housing_fee')::numeric, 0),
    coalesce((p_data->>'telecom_fee')::numeric, 0), coalesce((p_data->>'property_tax_monthly')::numeric, 0),
    coalesce((p_data->>'insurance_total')::numeric, 0))
  on conflict (household_id, effective_from) do update set
    loan_payment = excluded.loan_payment, housing_fee = excluded.housing_fee,
    telecom_fee = excluded.telecom_fee, property_tax_monthly = excluded.property_tax_monthly,
    insurance_total = excluded.insurance_total;

  insert into goals (household_id, category, target_amount, effective_from)
  select v_household_id, x.category, x.amount, v_month from (values
    ('living', coalesce((p_data->>'living')::numeric, 0)),
    ('savings', coalesce((p_data->>'savings')::numeric, 0)),
    ('pension', coalesce((p_data->>'pension')::numeric, 0)),
    ('emergency', coalesce((p_data->>'emergency')::numeric, 0)),
    ('allowance', coalesce((p_data->>'allowance')::numeric, 0))
  ) as x(category, amount)
  on conflict (household_id, category, effective_from) do update set target_amount = excluded.target_amount;

  update households h set
    onboarding_step = 'complete', onboarding_data = h.onboarding_data || p_data,
    onboarding_completed_at = now()
  where h.id = v_household_id returning h.* into v_household;
  return v_household;
end;
$$;

grant execute on function finalize_onboarding(jsonb) to authenticated;
