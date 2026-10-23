import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { createInvite, renameHousehold, updateProfile } from '@/api/household';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, ColorPicker, Field, Label, Screen, SectionTitle, styles } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { useHousehold } from '@/providers/household-provider';

export default function FamilyScreen() {
  const { household, members, memberById, userId } = useHousehold();
  const me = memberById.get(userId);
  const [householdName, setHouseholdName] = useState(household.name);
  const [displayName, setDisplayName] = useState(me?.profile.display_name ?? '');
  const [color, setColor] = useState(me?.profile.color ?? '#208AEF');
  const [busy, setBusy] = useState<'invite' | 'save' | null>(null);

  const invite = async () => {
    setBusy('invite');
    try {
      const code = await createInvite(household.id);
      await Share.share({
        message: `Join "${household.name}" on Family Tracker: open the app, sign in, choose "Join with code" and enter ${code} (valid for 7 days).`,
      });
    } catch (e) {
      Alert.alert('Could not create invite', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    try {
      await updateProfile(userId, { display_name: displayName.trim(), color });
      if (householdName.trim() && householdName.trim() !== household.name) {
        await renameHousehold(household.id, householdName.trim());
      }
      Alert.alert('Saved');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: household.name }} />
      <Screen>
        <SectionTitle>Members</SectionTitle>
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
            </View>
          ))}
          <Button title="Invite a family member" variant="secondary" onPress={invite} loading={busy === 'invite'} />
        </Card>

        <SectionTitle>Settings</SectionTitle>
        <Card style={{ gap: 16 }}>
          <Field label="Household name" value={householdName} onChangeText={setHouseholdName} />
          <Field label="Your name" value={displayName} onChangeText={setDisplayName} />
          <Label>Your color</Label>
          <ColorPicker value={color} onChange={setColor} />
          <Button title="Save" onPress={save} loading={busy === 'save'} disabled={!displayName.trim()} />
        </Card>

        <Button title="Sign out" variant="danger" onPress={signOut} />
      </Screen>
    </>
  );
}
