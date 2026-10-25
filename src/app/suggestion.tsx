import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addCategoryWithRoutines } from '@/api/routines';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, IconTile, Screen, styles } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/dialogs';
import { describeSchedule } from '@/lib/schedule';
import { getTemplate } from '@/lib/suggestions';
import { errorMessage } from '@/lib/errors';
import { useHousehold } from '@/providers/household-provider';


/** Preview a suggested category and pick which of its routines to add. */
export default function SuggestionScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const template = getTemplate(key);
  const theme = useTheme();
  const { household, userId } = useHousehold();
  const [picked, setPicked] = useState(() => new Set(template?.routines.map((r) => r.name)));
  const [busy, setBusy] = useState(false);

  if (!template) return <EmptyState icon="🤷" title="Suggestion not found" body="Try another one." />;

  const toggle = (name: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const add = async () => {
    setBusy(true);
    try {
      await addCategoryWithRoutines(
        { household_id: household.id, name: template.name, icon: template.icon },
        template.routines.filter((r) => picked.has(r.name)),
        template.visibility === 'personal' ? userId : null,
      );
      router.back();
    } catch (e) {
      showAlert('Could not add', errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Suggestion' }} />
      <Screen>
        <View style={[styles.row, { gap: Spacing.three }]}>
          <IconTile icon={template.icon} size={56} />
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle">{template.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {template.visibility === 'family' ? 'Shared with your family' : '🔒 Personal routines, only you see them'} · tick what fits
            </ThemedText>
          </View>
        </View>

        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {template.routines.map((r, i) => {
            const on = picked.has(r.name);
            return (
              <Pressable
                key={r.name}
                onPress={() => toggle(r.name)}
                style={({ pressed }) => [
                  local.row,
                  { opacity: pressed ? 0.6 : 1, borderTopColor: theme.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 },
                ]}>
                <View style={[local.box, { borderColor: on ? theme.tint : theme.backgroundSelected, backgroundColor: on ? theme.tint : 'transparent' }]}>
                  {on && <ThemedText style={{ color: theme.onTint, fontWeight: 800, fontSize: 15, lineHeight: 20 }}>✓</ThemedText>}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: 600 }}>{r.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {describeSchedule(r.schedule)}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </Card>

        <Button
          title={picked.size ? `Add ${template.name} · ${picked.size} routine${picked.size === 1 ? '' : 's'}` : `Add ${template.name}`}
          onPress={add}
          loading={busy}
        />
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          You can change schedules, times and who&apos;s responsible afterwards.
        </ThemedText>
      </Screen>
    </>
  );
}

const local = StyleSheet.create({
  row: { ...styles.row, paddingVertical: 12 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
