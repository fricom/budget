-- Budget 앱 DB 스키마 (Supabase Postgres)
-- 설계 기준: scenarios/{onboarding,home,expense-input,report,settings}.md (2026-07-24 확정)
-- 결정 사항(2026-07-24):
--   - 가구 공유: 각자 계정 + 초대코드로 가구 가입 (household_members.user_id로 로그인 계정 매핑)
--   - 카테고리: V1은 고정 기본값만 (expense_categories.household_id는 항상 NULL)
--   - 비상금 잔액: 목표 기반 자동적립만 (수동 "유입금" 입력 없음, 기존 스프레드시트와 다른 단순화된 로직)

create extension if not exists pgcrypto;

-- ============================================================
-- 가구 / 가구원
-- ============================================================

create table households (
  id uuid primary key default gen_random_uuid(),
  name text,                                   -- 선택적 표시용 이름 (예: "지원우혜네")
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- 가구원 = 소비 태깅 대상(최대 5명) + 로그인 계정 매핑(user_id, nullable)
-- 온보딩 시 이름만 입력된 "placeholder" 상태로 생성되고,
-- 초대코드로 들어온 실제 유저가 자신에 해당하는 슬롯을 선택(claim)하면 user_id가 채워짐.
-- 소득/목표/용돈배분 관리 대상은 position 1~2로 고정 (onboarding.md 규칙).
create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  name text not null,
  color text,                                  -- 태그 색상 (hex 등)
  user_id uuid references auth.users(id),       -- NULL이면 로그인 없는 태깅 전용(예: 아이)
  monthly_income numeric(12,0),                 -- position 1~2만 사용
  allowance_ratio numeric(4,3),                 -- position 1~2만 사용, 합계 1.0 (소득비례 기본값, 직접 조정 가능)
  created_at timestamptz not null default now(),
  unique (household_id, position),
  unique (household_id, user_id)
);

comment on column household_members.monthly_income is '소득관리 대상(처음 2명)만 값 존재. 3번째 이후는 NULL.';
comment on column household_members.allowance_ratio is '용돈 배분 비율. position 1,2 합=1.0. 기본값은 소득 비례, 온보딩/설정에서 직접 조정 가능.';

-- ============================================================
-- 고정비 (버전 관리 — 변경 시점 이후 달부터 적용, 과거 달 소급 변경 안 함)
-- ============================================================

create table fixed_costs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  effective_from date not null,                 -- 이 값이 적용되기 시작하는 달의 1일
  loan_payment numeric(12,0) not null default 0,
  housing_fee numeric(12,0) not null default 0,
  telecom_fee numeric(12,0) not null default 0,
  property_tax_monthly numeric(12,0) not null default 0,  -- 연 재산세 / 12 로 환산해 저장
  insurance_total numeric(12,0) not null default 0,       -- 가구원별 세부 항목은 B-2 백로그, V1은 합계만
  created_at timestamptz not null default now(),
  unique (household_id, effective_from)
);

comment on table fixed_costs is '조회 시 "select * from fixed_costs where household_id=X and effective_from <= 대상월 order by effective_from desc limit 1" 로 해당 월의 유효 값을 구함.';

-- ============================================================
-- 목표 (생활비/저축/노후자금/비상금/용돈) — 고정비와 동일한 버전 관리 방식
-- ============================================================

create table goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category text not null check (category in ('living','savings','pension','emergency','allowance')),
  target_amount numeric(12,0) not null,
  effective_from date not null,
  created_at timestamptz not null default now(),
  unique (household_id, category, effective_from)
);

-- ============================================================
-- 소비 카테고리 (V1: 고정 기본값만, household_id는 항상 NULL)
-- ============================================================

create table expense_categories (
  id smallint primary key,
  household_id uuid references households(id) on delete cascade,  -- V1에서는 항상 NULL. 향후 가구별 커스텀 확장 여지.
  name text not null,
  type text not null check (type in ('general','emergency')),
  sort_order smallint not null
);

insert into expense_categories (id, household_id, name, type, sort_order) values
  (1, null, '생활', 'general', 1),
  (2, null, '자녀', 'general', 2),
  (3, null, '외식', 'general', 3),
  (4, null, '교통', 'general', 4),
  (5, null, '여가', 'general', 5),
  (6, null, '쇼핑', 'general', 6),
  (7, null, '의료', 'general', 7),
  (8, null, '기타', 'general', 8),
  (9, null, '병원비', 'emergency', 1),
  (10, null, '차량관리', 'emergency', 2),
  (11, null, '여행비', 'emergency', 3),
  (12, null, '가족경조사', 'emergency', 4),
  (13, null, '지인경조사', 'emergency', 5);

-- ============================================================
-- 지출
-- ============================================================

create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references household_members(id),     -- 가구원 태그 (누구 소비인지)
  category_id smallint not null references expense_categories(id),
  entered_by_user_id uuid not null references auth.users(id),    -- 실제 입력한 로그인 유저
  item_name text not null,
  amount numeric(12,0) not null check (amount > 0),
  expense_date date not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expenses_household_date on expenses (household_id, expense_date);
create index idx_expenses_household_category on expenses (household_id, category_id);

comment on table expenses is '일반(8개)/비상금(5개) 모드는 category_id → expense_categories.type 으로 구분. 별도 mode 컬럼 없음.';

-- ============================================================
-- 저축 / 노후자금 이체 완료 체크
-- ============================================================

create table monthly_transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category text not null check (category in ('savings','pension')),
  year_month date not null,                     -- 해당 월 1일
  is_completed boolean not null default false,
  completed_at timestamptz,
  transferred_amount numeric(12,0),
  unique (household_id, category, year_month)
);

-- 비상금은 목표 기반 자동적립이라 이체 완료 체크가 없음.
-- 이번달 비상금 잔액 = 지난달 잔액 + 이번달 목표액(goals.emergency) - 이번달 emergency 카테고리 지출 합계
-- (별도 잔액 테이블 없이 expenses + goals 조회로 매번 계산. 월별 스냅샷이 필요해지면 emergency_fund_snapshots 추가 검토)

-- ============================================================
-- 알림 설정
-- ============================================================

create table notification_settings (
  household_id uuid primary key references households(id) on delete cascade,
  goal_exceeded_alert boolean not null default true,
  transfer_incomplete_alert boolean not null default true,
  alert_timing text not null default 'immediate' check (alert_timing in ('immediate','daily_summary'))
);

-- ============================================================
-- 구글 시트 내보내기 (선택 기능, 원본 DB 아님)
-- ============================================================

create table sheet_sync_settings (
  household_id uuid primary key references households(id) on delete cascade,
  enabled boolean not null default false,
  google_refresh_token text,                    -- 반드시 애플리케이션 레벨에서 암호화 후 저장
  target_spreadsheet_id text,
  last_synced_at timestamptz
);

-- ============================================================
-- 구독/결제 (placeholder — 하이브리드 결제 세부 플로우는 추후 설계)
-- ============================================================

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  status text not null check (status in ('trial','active','canceled','expired')),
  payment_provider text check (payment_provider in ('apple_iap','google_iap','external_web')),
  external_reference text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
-- 공통 원칙: household_id를 가진 모든 테이블은
--   "household_members에 household_id=이 행의 household_id AND user_id=auth.uid() 인 행이 존재"
-- 를 접근 조건으로 함. household_members 자체도 같은 조건(자기 가구 행만 조회).
-- 초대코드로 슬롯을 claim하는 동작(household_members.user_id를 NULL→본인으로 UPDATE)은
-- RLS로 직접 열어주지 않고 SECURITY DEFINER 함수(rpc)로 invite_code 검증 후 처리 권장.

alter table households enable row level security;
alter table household_members enable row level security;
alter table fixed_costs enable row level security;
alter table goals enable row level security;
alter table expenses enable row level security;
alter table monthly_transfers enable row level security;
alter table notification_settings enable row level security;
alter table sheet_sync_settings enable row level security;
alter table subscriptions enable row level security;

create policy household_members_access on household_members
  for select using (
    exists (
      select 1 from household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
    )
  );

-- households/household_members는 최초 생성 시점에 RLS를 통과할 household_members 행이
-- 아직 없는 부트스트랩 문제가 있음 (닭-달걀). 가구 생성 + 첫 가구원(생성자) 등록은
-- 클라이언트에서 직접 insert하지 말고, 두 작업을 원자적으로 처리하는
-- SECURITY DEFINER RPC 함수(예: create_household(name, member_name))로 노출할 것.
-- 초대코드로 슬롯 claim(user_id NULL→본인 UPDATE)도 동일하게 RPC로 처리.
create policy households_access on households
  for select using (
    exists (
      select 1 from household_members hm
      where hm.household_id = households.id
        and hm.user_id = auth.uid()
    )
  );

-- 아래 테이블들은 동일 패턴 반복 (select/insert/update 각각 household_members 존재 여부로 체크)
create policy fixed_costs_access on fixed_costs
  for all using (
    exists (select 1 from household_members hm where hm.household_id = fixed_costs.household_id and hm.user_id = auth.uid())
  );

create policy goals_access on goals
  for all using (
    exists (select 1 from household_members hm where hm.household_id = goals.household_id and hm.user_id = auth.uid())
  );

create policy expenses_access on expenses
  for all using (
    exists (select 1 from household_members hm where hm.household_id = expenses.household_id and hm.user_id = auth.uid())
  );

create policy monthly_transfers_access on monthly_transfers
  for all using (
    exists (select 1 from household_members hm where hm.household_id = monthly_transfers.household_id and hm.user_id = auth.uid())
  );

create policy notification_settings_access on notification_settings
  for all using (
    exists (select 1 from household_members hm where hm.household_id = notification_settings.household_id and hm.user_id = auth.uid())
  );

create policy sheet_sync_settings_access on sheet_sync_settings
  for all using (
    exists (select 1 from household_members hm where hm.household_id = sheet_sync_settings.household_id and hm.user_id = auth.uid())
  );

create policy subscriptions_access on subscriptions
  for all using (
    exists (select 1 from household_members hm where hm.household_id = subscriptions.household_id and hm.user_id = auth.uid())
  );

-- expense_categories는 household_id가 항상 NULL(V1)이라 전체 공개 read-only로 충분
alter table expense_categories enable row level security;
create policy expense_categories_read on expense_categories for select using (true);
