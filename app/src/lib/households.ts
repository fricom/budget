import { supabase } from '@/lib/supabase';

export type HouseholdMember = {
  id: string;
  household_id: string;
  position: number;
  name: string;
  color: string | null;
  user_id: string | null;
  monthly_income: number | null;
  allowance_ratio: number | null;
  created_at: string;
};

export type InvitePreviewRow = {
  household_name: string | null;
  member_id: string;
  member_position: number;
  member_name: string;
  is_claimed: boolean;
};

export async function createHousehold(householdName: string, firstMemberName: string) {
  const { data, error } = await supabase
    .rpc('create_household', {
      p_household_name: householdName,
      p_member_name: firstMemberName,
    })
    .single<HouseholdMember>();
  if (error) throw error;
  return data;
}

export async function addHouseholdMember(householdId: string, position: number, name: string) {
  const { data, error } = await supabase
    .from('household_members')
    .insert({ household_id: householdId, position, name })
    .select()
    .single<HouseholdMember>();
  if (error) throw error;
  return data;
}

export async function getInvitePreview(inviteCode: string) {
  const { data, error } = await supabase.rpc('get_invite_preview', {
    p_invite_code: inviteCode,
  });
  if (error) throw error;
  return (data ?? []) as InvitePreviewRow[];
}

export async function joinHousehold(inviteCode: string, memberId: string) {
  const { data, error } = await supabase
    .rpc('join_household', {
      p_invite_code: inviteCode,
      p_member_id: memberId,
    })
    .single<HouseholdMember>();
  if (error) throw error;
  return data;
}

export async function getHouseholdInviteCode(householdId: string) {
  const { data, error } = await supabase
    .from('households')
    .select('invite_code')
    .eq('id', householdId)
    .single<{ invite_code: string }>();
  if (error) throw error;
  return data.invite_code;
}
