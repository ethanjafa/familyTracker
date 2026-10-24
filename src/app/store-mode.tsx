import { Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOutRight, LinearTransition } from 'react-native-reanimated';

import { setGroceryStatus, useGroceries } from '@/api/groceries';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, Loading, Screen, useElevation } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** In the store: only what you need, big targets, and each item slides away once it's in the cart. */
export default function StoreMode() {
  const theme = useTheme();
  const elevation = useElevation();
  const groceries = useGroceries();
  const need = (groceries.data ?? []).filter((i) => i.status === 'need');

  return (
    <>
      <Stack.Screen options={{ title: need.length ? `🛒 ${need.length} to go` : '🛒 Store mode' }} />
      <Screen>
        {groceries.isPending ? (
          <Loading />
        ) : need.length === 0 ? (
          <EmptyState icon="🎉" title="All done!" body="Everything on the list is in the cart. Time to head home." />
        ) : (
          <>
            {need.map((item) => (
              <Animated.View key={item.id} exiting={FadeOutRight.duration(220)} layout={LinearTransition.duration(200)}>
                <Pressable
                  onPress={() => setGroceryStatus(item, 'have')}
                  style={({ pressed }) => [
                    local.item,
                    { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
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
