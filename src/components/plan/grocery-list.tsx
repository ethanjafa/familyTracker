import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { deleteGrocery, needGroceries, setGroceryStatus, useGroceries } from '@/api/groceries';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Loading, ProgressBar, SectionTitle, styles } from '@/components/ui';
import { FontFamilies, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import type { GroceryItem } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

/** Plan → Groceries: one long household list. Every item is either "need" or "have". */
export function GroceryList() {
  const theme = useTheme();
  const { household } = useHousehold();
  const groceries = useGroceries();
  const [text, setText] = useState('');
  const [showHave, setShowHave] = useState(false);
  const [editing, setEditing] = useState(false);

  if (groceries.isPending) return <Loading />;
  const all = groceries.data ?? [];
  const need = all.filter((i) => i.status === 'need');
  const have = all.filter((i) => i.status === 'have');

  const add = async () => {
    const names = text.split(',').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setText('');
    try {
      await needGroceries(household.id, names);
    } catch (e) {
      showAlert('Could not add', errorMessage(e));
    }
  };

  const remove = (item: GroceryItem) => deleteGrocery(item.id).catch((e) => showAlert('Could not delete', errorMessage(e)));

  return (
    <>
      <View style={[styles.row, { gap: Spacing.two }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          placeholder="Add items, e.g. milk, eggs"
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.tint}
          returnKeyType="done"
          style={[local.input, { backgroundColor: theme.backgroundElement, color: theme.text, fontFamily: FontFamilies[500] }]}
        />
        <Pressable
          onPress={add}
          style={({ pressed }) => [local.add, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}>
          <ThemedText style={{ color: theme.onTint, fontWeight: 800, fontSize: 22, lineHeight: 26 }}>+</ThemedText>
        </Pressable>
      </View>

      {all.length === 0 ? (
        <EmptyState
          icon="🛒"
          title="Your grocery list is empty"
          body="Add the things your household buys. Plan meals with ingredients and they show up here by themselves."
        />
      ) : (
        <>
          {need.length > 0 && <Button title={`🛒 Store mode · ${need.length} to buy`} onPress={() => router.push('/store-mode')} />}
          <ProgressBar value={all.length ? (100 * have.length) / all.length : 0} />

          <SectionTitle
            right={
              <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8}>
                <ThemedText type="small" themeColor={editing ? 'tint' : 'textSecondary'} style={{ fontWeight: 700 }}>
                  {editing ? 'Done' : 'Edit list'}
                </ThemedText>
              </Pressable>
            }>
            Need to buy ({need.length})
          </SectionTitle>
          {need.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing to buy. Tap Need on anything that runs out 🎉
            </ThemedText>
          ) : (
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {need.map((i, idx) => (
                <GroceryRow key={i.id} item={i} first={idx === 0} editing={editing} onDelete={() => remove(i)} />
              ))}
            </Card>
          )}

          <Pressable onPress={() => setShowHave((s) => !s)} hitSlop={8}>
            <SectionTitle right={<ThemedText themeColor="textSecondary">{showHave ? '▾' : '▸'}</ThemedText>}>
              We have ({have.length})
            </SectionTitle>
          </Pressable>
          {showHave && have.length > 0 && (
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {have.map((i, idx) => (
                <GroceryRow key={i.id} item={i} first={idx === 0} editing={editing} onDelete={() => remove(i)} />
              ))}
            </Card>
          )}
        </>
      )}
    </>
  );
}

function GroceryRow({ item, first, editing, onDelete }: { item: GroceryItem; first: boolean; editing: boolean; onDelete: () => void }) {
  const theme = useTheme();
  const needed = item.status === 'need';
  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={[local.row, !first && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <ThemedText style={{ fontSize: 16 }}>{needed ? '🛒' : '✓'}</ThemedText>
      <View style={{ flex: 1 }}>
        <ThemedText style={needed ? { fontWeight: 600 } : { opacity: 0.7 }}>{item.name}</ThemedText>
        {item.for_label && (
          <ThemedText type="small" themeColor="textSecondary">
            for {item.for_label}
          </ThemedText>
        )}
      </View>
      {editing ? (
        <Pressable onPress={onDelete} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <ThemedText type="small" style={{ color: theme.danger, fontWeight: 700 }}>
            Delete
          </ThemedText>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setGroceryStatus(item, needed ? 'have' : 'need')}
          hitSlop={6}
          style={({ pressed }) => [
            local.toggle,
            { backgroundColor: needed ? theme.tintSoft : theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
          ]}>
          <ThemedText type="small" style={{ fontWeight: 700, color: needed ? theme.tint : theme.textSecondary }}>
            {needed ? 'Have' : 'Need'}
          </ThemedText>
        </Pressable>
      )}
    </Animated.View>
  );
}

const local = StyleSheet.create({
  input: { flex: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 14, fontSize: 16 },
  add: { width: 50, height: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  toggle: { borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 6, minWidth: 64, alignItems: 'center' },
});
