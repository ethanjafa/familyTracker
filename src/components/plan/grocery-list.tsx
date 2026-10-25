import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { deleteGrocery, needGroceries, setGroceryStatus, useGroceries } from '@/api/groceries';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Loading, SectionTitle, styles } from '@/components/ui';
import { FontFamilies, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import type { GroceryItem, GroceryStatus } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

const STATUSES: { value: GroceryStatus; label: string }[] = [
  { value: 'need', label: 'Need' },
  { value: 'have', label: 'Have' },
  { value: 'backlog', label: 'Backlog' },
];

/** Groceries: one household list in three parts. Need to buy, we have, and the backlog (bought now and then). */
export function GroceryList() {
  const theme = useTheme();
  const { household } = useHousehold();
  const groceries = useGroceries();
  const [text, setText] = useState('');
  const [open, setOpen] = useState<Set<GroceryStatus>>(new Set(['need']));
  const [editing, setEditing] = useState(false);

  if (groceries.isPending) return <Loading />;
  const all = groceries.data ?? [];
  const byStatus = (s: GroceryStatus) => all.filter((i) => i.status === s);
  const need = byStatus('need');

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

  const toggle = (s: GroceryStatus) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  const remove = (item: GroceryItem) => deleteGrocery(item.id).catch((e) => showAlert('Could not delete', errorMessage(e)));

  const sections: { status: GroceryStatus; title: string; empty: string }[] = [
    { status: 'need', title: '🛒 Need to buy', empty: 'Nothing to buy 🎉' },
    { status: 'have', title: '✓ We have', empty: 'Nothing marked as in the house yet.' },
    { status: 'backlog', title: '📦 Backlog', empty: 'Things you buy now and then go here.' },
  ];

  return (
    <>
      <View style={[styles.row, { gap: Spacing.two }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          placeholder="Add items to buy, e.g. milk, eggs"
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.tint}
          returnKeyType="done"
          style={[local.input, { backgroundColor: theme.backgroundElement, color: theme.text, fontFamily: FontFamilies[500] }]}
        />
        <Pressable onPress={add} style={({ pressed }) => [local.add, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}>
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
          <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
            <ThemedText type="small" themeColor={editing ? 'tint' : 'textSecondary'} style={{ fontWeight: 700 }}>
              {editing ? 'Done' : 'Edit list'}
            </ThemedText>
          </Pressable>

          {sections.map(({ status, title, empty }) => {
            const items = byStatus(status);
            const isOpen = open.has(status);
            return (
              <View key={status} style={{ gap: 8 }}>
                <Pressable onPress={() => toggle(status)} hitSlop={8}>
                  <SectionTitle right={<ThemedText themeColor="textSecondary">{isOpen ? '▾' : '▸'}</ThemedText>}>
                    {title} ({items.length})
                  </SectionTitle>
                </Pressable>
                {isOpen &&
                  (items.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {empty}
                    </ThemedText>
                  ) : (
                    <Card style={{ gap: 0, paddingVertical: 4 }}>
                      {items.map((i, idx) => (
                        <GroceryRow key={i.id} item={i} first={idx === 0} editing={editing} onDelete={() => remove(i)} />
                      ))}
                    </Card>
                  ))}
              </View>
            );
          })}
        </>
      )}
    </>
  );
}

function GroceryRow({ item, first, editing, onDelete }: { item: GroceryItem; first: boolean; editing: boolean; onDelete: () => void }) {
  const theme = useTheme();
  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={[local.row, !first && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1 }}>
        <ThemedText style={item.status === 'need' ? { fontWeight: 600 } : { opacity: 0.75 }} numberOfLines={1}>
          {item.name}
        </ThemedText>
        {item.for_label && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
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
        <View style={[local.switch, { backgroundColor: theme.backgroundElement }]}>
          {STATUSES.map((s) => {
            const selected = item.status === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => !selected && setGroceryStatus(item, s.value)}
                hitSlop={4}
                style={[local.option, selected && { backgroundColor: s.value === 'need' ? theme.tint : theme.card }]}>
                <ThemedText
                  type="small"
                  style={{
                    fontSize: 12,
                    fontWeight: selected ? 700 : 500,
                    color: selected ? (s.value === 'need' ? theme.onTint : theme.text) : theme.textSecondary,
                  }}>
                  {s.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

const local = StyleSheet.create({
  input: { flex: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 14, fontSize: 16 },
  add: { width: 50, height: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  switch: { flexDirection: 'row', borderRadius: Radius.pill, padding: 2 },
  option: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
});
