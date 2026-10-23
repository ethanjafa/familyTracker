import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, HeaderButton, IconTile, Loading, ProgressBar, Screen, ScorePill, Segmented, styles } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import { weekStart } from '@/lib/dates';
import { pct, scoreRoutines } from '@/lib/scoring';
import type { Visibility } from '@/lib/types';

export default function RoutinesScreen() {
  const data = useRoutineData();
  const [visibility, setVisibility] = useState<Visibility>('personal');
  const now = new Date();

  const categories = data.categories.filter((c) => c.visibility === visibility);
  const addCategory = () => router.push({ pathname: '/category-form', params: { visibility } });

  return (
    <>
      <Stack.Screen
        options={{ title: 'Routines', headerRight: () => <HeaderButton title="+" onPress={addCategory} /> }}
      />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        <Segmented
          options={[
            { value: 'personal', label: '🙋 Personal' },
            { value: 'family', label: '👨‍👩‍👧 Family' },
          ]}
          value={visibility}
          onChange={setVisibility}
        />

        {data.isLoading ? (
          <Loading />
        ) : categories.length === 0 ? (
          <EmptyState
            icon={visibility === 'personal' ? '🧘' : '🏠'}
            title={`No ${visibility} categories yet`}
            body={
              visibility === 'personal'
                ? 'Group your own habits, e.g. Health → Morning run, Read 20 min.'
                : 'Shared with everyone at home, e.g. House cleanliness → Wash dishes.'
            }
            action={<Button title="Add a category" onPress={addCategory} />}
          />
        ) : (
          categories.map((c) => {
            const routines = data.routines.filter((r) => r.category_id === c.id);
            const score = pct(scoreRoutines(routines, data.logIndex, weekStart(now), now));
            return (
              <Card key={c.id} onPress={() => router.push(`/routines/${c.id}`)}>
                <View style={styles.row}>
                  <IconTile icon={c.icon} color={c.color} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                      {c.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {routines.length} routine{routines.length === 1 ? '' : 's'} · this week
                    </ThemedText>
                  </View>
                  <ScorePill value={score} />
                </View>
                {score !== null && <ProgressBar value={score} />}
              </Card>
            );
          })
        )}
      </Screen>
    </>
  );
}
