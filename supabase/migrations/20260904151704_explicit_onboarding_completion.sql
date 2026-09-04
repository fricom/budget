-- 기존 가구는 이미 사용 중이므로 완료 상태로 백필하고,
-- 이후 생성되는 가구부터 최종 CTA에서 명시적으로 완료한다.
alter table households
  add column if not exists onboarding_step text not null default 'household-success',
  add column if not exists onboarding_completed_at timestamptz;

update households
set onboarding_step = 'complete',
    onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where onboarding_completed_at is null;

comment on column households.onboarding_step is '온보딩 중단 후 재개할 단계. 완료 전까지만 사용.';
comment on column households.onboarding_completed_at is '모든 초기 설정 저장이 끝난 시각. NULL이면 홈 진입 불가.';

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

  update households h
  set onboarding_step = 'complete',
      onboarding_completed_at = coalesce(h.onboarding_completed_at, now())
  where h.id = (
    select hm.household_id
    from household_members hm
    where hm.user_id = auth.uid()
    order by hm.created_at
    limit 1
  )
  returning h.* into v_household;

  if v_household is null then
    raise exception 'household membership required';
  end if;

  return v_household;
end;
$$;

grant execute on function complete_onboarding() to authenticated;
