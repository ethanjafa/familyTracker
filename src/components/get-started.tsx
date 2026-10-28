import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, ProgressBar } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { getFlag, setFlag } from '@/lib/device-flags';

export type Step = { title: string; detail: string; done: boolean; href: Href };

const HIDDEN_FLAG = 'get-started-hidden';

/**
 * First-run checklist on Today. Steps tick themselves off from real data; the card disappears
 * once everything is done, or for good when hidden.
 */
export function GetStarted({ steps }: { steps: Step[] }) {
  const theme = useTheme();
  const [hidden, setHidden] = useState(() => getFlag(HIDDEN_FLAG));
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;

  const hide = () => {
    setFlag(HIDDEN_FLAG);
    setHidden(true);
  };

  return (
    <Card style={{ gap: 10 }}>
      <View style={local.header}>
        <ThemedText type="smallBold" style={{ fontSize: 16 }}>
          🚀 Get started · {done} of {steps.length}
        </ThemedText>
        <Pressable onPress={hide} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: 600 }}>
            Hide
          </ThemedText>
        </Pressable>
      </View>
      <ProgressBar value={(100 * done) / steps.length} color={theme.tint} />
      {steps.map((s, i) => (
        <Pressable
          key={s.title}
          disabled={s.done}
          onPress={() => router.push(s.href)}
          style={({ pressed }) => [local.step, { opacity: pressed ? 0.6 : 1 }]}>
          <View style={[local.check, { borderColor: s.done ? theme.success : theme.backgroundSelected, backgroundColor: s.done ? theme.success : 'transparent' }]}>
            <ThemedText style={local.mark}>{s.done ? '✓' : ''}</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ fontWeight: 600, ...(s.done ? { textDecorationLine: 'line-through', opacity: 0.55 } : {}) }}>
              {i + 1}. {s.title}
            </ThemedText>
            {!s.done && (
              <ThemedText type="small" themeColor="textSecondary">
                {s.detail}
              </ThemedText>
            )}
          </View>
          {!s.done && (
            <ThemedText themeColor="tint" style={{ fontSize: 22 }}>
              ›
            </ThemedText>
          )}
        </Pressable>
      ))}
    </Card>
  );
}

const local = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  mark: { color: '#fff', fontWeight: 800, fontSize: 13, lineHeight: 17 },
});
