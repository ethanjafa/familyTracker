import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { deleteGrocery, needGroceries, setGroceryStatus, setGroceryStore, storesOf, useGroceries } from '@/api/groceries';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, Loading, SectionTitle, styles } from '@/components/ui';
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
  const [picking, setPicking] = useState<string | null>(null);

  if (groceries.isPending) return <Loading />;
  const all = groceries.data ?? [];
  const byStatus = (s: GroceryStatus) => all.filter((i) => i.status === s);
  const need = byStatus('need');
  const stores = storesOf(all);

  const add = async () => {
    const names = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
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
    {
      status: 'have',
      title: '✓ We have',
      empty: 'Nothing marked as in the house yet.',
    },
    {
      status: 'backlog',
      title: '📦 Backlog',
      empty: 'Things you buy now and then go here.',
    },
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
          style={[
            local.input,
            {
              backgroundColor: theme.backgroundElement,
              color: theme.text,
              fontFamily: FontFamilies[500],
            },
          ]}
        />
        <Pressable
          onPress={add}
          style={({ pressed }) => [local.add, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}>
          <ThemedText
            style={{
              color: theme.onTint,
              fontWeight: 800,
              fontSize: 22,
              lineHeight: 26,
            }}>
            +
          </ThemedText>
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
          {need.length > 0 && (
            <Button title={`🛒 Store mode · ${need.length} to buy`} onPress={() => router.push('/store-mode')} />
          )}
          <View style={[styles.row, { justifyContent: 'space-between', gap: Spacing.two }]}>
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
              {stores.length ? '' : 'Tip: tap an item to set where you buy it'}
            </ThemedText>
            <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8}>
              <ThemedText type="small" themeColor={editing ? 'tint' : 'textSecondary'} style={{ fontWeight: 700 }}>
                {editing ? 'Done' : 'Edit list'}
              </ThemedText>
            </Pressable>
          </View>

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
                        <GroceryRow
                          key={i.id}
                          item={i}
                          first={idx === 0}
                          editing={editing}
                          stores={stores}
                          picking={picking === i.id}
                          onPick={() => setPicking((p) => (p === i.id ? null : i.id))}
                          onDelete={() => remove(i)}
                        />
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

function GroceryRow({
  item,
  first,
  editing,
  stores,
  picking,
  onPick,
  onDelete,
}: {
  item: GroceryItem;
  first: boolean;
  editing: boolean;
  stores: string[];
  picking: boolean;
  onPick: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const detail = [item.store && `📍 ${item.store}`, item.for_label && `for ${item.for_label}`].filter(Boolean).join(' · ');
  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={
        !first && {
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        }
      }>
      <View style={local.row}>
        <Pressable onPress={onPick} hitSlop={4} style={{ flex: 1 }}>
          <ThemedText style={item.status === 'need' ? { fontWeight: 600 } : { opacity: 0.75 }} numberOfLines={1}>
            {item.name}
          </ThemedText>
          {detail ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {detail}
            </ThemedText>
          ) : null}
        </Pressable>
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
                  style={[
                    local.option,
                    selected && {
                      backgroundColor: s.value === 'need' ? theme.tint : theme.card,
                    },
                  ]}>
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
      </View>
      {picking && <StorePicker item={item} stores={stores} onDone={onPick} />}
    </Animated.View>
  );
}

/** Where to buy it: tap a store you already use, type a new one, or clear it. */
function StorePicker({ item, stores, onDone }: { item: GroceryItem; stores: string[]; onDone: () => void }) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const pick = (store: string | null) => {
    setGroceryStore(item, store);
    onDone();
  };
  const addNew = () => {
    const name = text.trim();
    if (!name) return;
    // "costco" when "Costco" already exists should land in the same group.
    pick(stores.find((s) => s.toLowerCase() === name.toLowerCase()) ?? name);
  };
  return (
    <View style={{ gap: Spacing.two, paddingBottom: 12 }}>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 600 }}>
        Where do you buy it?
      </ThemedText>
      {stores.length > 0 && (
        <View style={styles.wrap}>
          {stores.map((s) => (
            <Chip key={s} label={s} selected={item.store === s} onPress={() => pick(item.store === s ? null : s)} />
          ))}
          {item.store && <Chip label="Anywhere" selected={false} onPress={() => pick(null)} />}
        </View>
      )}
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={addNew}
        placeholder={stores.length ? 'Or a new store' : 'e.g. Costco, Food Basics'}
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.tint}
        returnKeyType="done"
        autoCapitalize="words"
        style={[
          local.storeInput,
          {
            backgroundColor: theme.backgroundElement,
            color: theme.text,
            fontFamily: FontFamilies[500],
          },
        ]}
      />
    </View>
  );
}

const local = StyleSheet.create({
  input: {
    flex: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
  add: {
    width: 50,
    height: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  switch: { flexDirection: 'row', borderRadius: Radius.pill, padding: 2 },
  option: {
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  storeInput: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
  },
});
