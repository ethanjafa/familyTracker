import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, IconTile, Screen, styles } from '@/components/ui';

const CHOICES = [
  {
    icon: '🔁',
    title: 'New routine',
    body: 'Something that repeats: every day, on certain days, or a few times a week.',
    pathname: '/routine-form' as const,
  },
  {
    icon: '📝',
    title: 'New to-do',
    body: 'A one-off task for a day, with an owner. Or keep it in the backlog for later.',
    pathname: '/todo-form' as const,
  },
];

/** "Create" from Today: pick what to add, then go straight to its form. */
export default function CreateScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Create' }} />
      <Screen>
        {CHOICES.map((c) => (
          <Card key={c.title} onPress={() => router.replace(c.pathname)}>
            <View style={styles.row}>
              <IconTile icon={c.icon} />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                  {c.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.body}
                </ThemedText>
              </View>
            </View>
          </Card>
        ))}
      </Screen>
    </>
  );
}
