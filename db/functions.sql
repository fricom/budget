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
