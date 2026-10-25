import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { createInvite, removeMember, setPlanningDay, updateHousehold, updateProfile } from '@/api/household';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Dropdown, Field, Screen, SectionTitle, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { signOut } from '@/lib/auth';
import { confirmAsync, showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { PLANNING_DAY_NAMES, planningDayOf } from '@/lib/planning';
import type { Member } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

export default function SettingsScreen() {
  const theme = useTheme();
  const { household, members, memberById, userId } = useHousehold();
  const me = memberById.get(userId);
  const isOwner = me?.role === 'owner';
  const [householdName, setHouseholdName] = useState(household.name);
  const [displayName, setDisplayName] = useState(me?.profile.display_name ?? '');
  const [busy, setBusy] = useState<'invite' | 'save' | null>(null);

  const invite = async () => {
    setBusy('invite');
    try {
      const code = await createInvite(household.id);
      await Share.share({
        message: `Join "${household.name}" on Dragon Boat: open the app, sign in, choose "Join with code" and enter ${code} (valid for 7 days).`,
      });
    } catch (e) {
      showAlert('Could not create invite', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (m: Member) => {
    const ok = await confirmAsync(
      `Remove ${m.profile.display_name}?`,
      'They lose access to the family routines and to-dos, and are taken off everything assigned to them. You can invite them again later.',
      'Remove',
    );
    if (!ok) return;
    try {
      await removeMember(household.id, m.user_id);
    } catch (e) {
      showAlert('Could not remove', errorMessage(e));
    }
  };

  const changePlanningDay = (day: number) =>
    setPlanningDay(household.id, day).catch((e) =>
      showAlert(
        'Could not save',
        errorMessage(e).includes('set_planning_day')
          ? 'This needs a quick database update. Run supabase/migrations/20261027000000_planning_day.sql in the Supabase SQL Editor, then try again.'
          : errorMessage(e),
      ),
    );

  const save = async () => {
    setBusy('save');
    try {
      await updateProfile(userId, { display_name: displayName.trim() });
      if (householdName.trim() && householdName.trim() !== household.name) {
        await updateHousehold(household.id, { name: householdName.trim() });
      }
      showAlert('Saved');
    } catch (e) {
      showAlert('Could not save', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Screen>
        <SectionTitle>Family</SectionTitle>
        <Card>
          {members.map((m) => (
            <View key={m.user_id} style={[styles.row, { paddingVertical: 4 }]}>
              <Avatar profile={m.profile} size={36} />
              <View style={{ flex: 1 }}>
                <ThemedText>
                  {m.profile.display_name}
                  {m.user_id === userId ? ' (you)' : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {m.role === 'owner' ? 'Owner' : 'Member'}
                </ThemedText>
              </View>
              {isOwner && m.user_id !== userId && (
                <Pressable onPress={() => remove(m)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                  <ThemedText type="small" style={{ color: theme.danger, fontWeight: 700 }}>
                    Remove
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ))}
          <Button title="Invite a family member" variant="secondary" onPress={invite} loading={busy === 'invite'} />
        </Card>

        <SectionTitle>Planning day</SectionTitle>
        <Card>
          <Dropdown options={PLANNING_DAY_NAMES} value={planningDayOf(household)} onChange={changePlanningDay} />
          <ThemedText type="small" themeColor="textSecondary">
            That day, everyone gets a ⛵ Plan the week together task on Today.
          </ThemedText>
        </Card>

        <SectionTitle>Profile</SectionTitle>
        <Card style={{ gap: 16 }}>
          <Field label="Household name" value={householdName} onChangeText={setHouseholdName} />
          <Field label="Your name" value={displayName} onChangeText={setDisplayName} />
          <Button title="Save" onPress={save} loading={busy === 'save'} disabled={!displayName.trim()} />
        </Card>

        <Button title="Sign out" variant="danger" onPress={signOut} />
      </Screen>
    </>
  );
}
