import { Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOutRight, LinearTransition } from 'react-native-reanimated';

import { setGroceryStatus, useGroceries } from '@/api/groceries';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, Loading, Screen, SectionTitle, useElevation } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GroceryItem } from '@/lib/types';

/** Need items by store, A–Z, with items that have no store last. */
function byStore(items: GroceryItem[]) {
  const groups = new Map<string, { store: string | null; items: GroceryItem[] }>();
  for (const i of items) {
    const key = i.store?.toLowerCase() ?? '';
    if (!groups.has(key)) groups.set(key, { store: i.store, items: [] });
    groups.get(key)!.items.push(i);
  }
  return [...groups.values()].sort((a, b) => (a.store === null ? 1 : b.store === null ? -1 : a.store.localeCompare(b.store)));
}

/** In the store: only what you need, grouped by store, big targets, and each item slides away once it's in the cart. */
export default function StoreMode() {
  const theme = useTheme();
  const elevation = useElevation();
  const groceries = useGroceries();
  const need = (groceries.data ?? []).filter((i) => i.status === 'need');
  const groups = byStore(need);
  // Only show headings when the list is actually split across stores.
  const showHeadings = groups.length > 1 || groups[0]?.store != null;

  return (
    <>
      <Stack.Screen
        options={{
          title: need.length ? `🛒 ${need.length} to go` : '🛒 Store mode',
        }}
      />
      <Screen>
        {groceries.isPending ? (
          <Loading />
        ) : need.length === 0 ? (
          <EmptyState icon="🎉" title="All done!" body="Everything on the list is in the cart. Time to head home." />
        ) : (
          <>
            {groups.map(({ store, items }) => (
              <Animated.View
                key={store?.toLowerCase() ?? ''}
                exiting={FadeOutRight.duration(220)}
                layout={LinearTransition.duration(200)}
                style={{ gap: 12 }}>
                {showHeadings && (
                  <SectionTitle>
                    {store ? `📍 ${store}` : 'Anywhere'} ({items.length})
                  </SectionTitle>
                )}
                {items.map((item) => (
                  <Animated.View key={item.id} exiting={FadeOutRight.duration(220)} layout={LinearTransition.duration(200)}>
                    <Pressable
                      onPress={() => setGroceryStatus(item, 'have')}
                      style={({ pressed }) => [
                        local.item,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                        elevation,
                      ]}>
                      <View style={[local.box, { borderColor: theme.tint }]} />
                      <View style={{ flex: 1 }}>
                        <ThemedText type="heading" style={{ fontSize: 20 }}>
                          {item.name}
                        </ThemedText>
                        {item.for_label && (
                          <ThemedText type="small" themeColor="textSecondary">
                            for {item.for_label}
                          </ThemedText>
                        )}
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
              </Animated.View>
            ))}
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              Tap an item once it&apos;s in the cart
            </ThemedText>
          </>
        )}
      </Screen>
    </>
  );
}

const local = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  box: { width: 28, height: 28, borderRadius: 9, borderWidth: 2.5 },
});
