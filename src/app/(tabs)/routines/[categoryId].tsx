import { subDays } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, EmptyState, HeaderButton, Loading, Screen, ScorePill, SectionTitle, styles } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import { weekStart } from '@/lib/dates';
import { describeSchedule } from '@/lib/schedule';
import { pct, scoreRoutine, streak } from '@/lib/scoring';
import { useHousehold } from '@/providers/household-provider';

const TIME_LABEL = { morning: '🌅 Morning', day: '☀️ Day', evening: '🌙 Evening', anytime: '' };

export default function CategoryScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { memberById } = useHousehold();
  const data = useRoutineData();
  const category = data.categoryById.get(categoryId);
  const now = new Date();

  if (data.isLoading) return <Loading />;
  if (!category) return <EmptyState icon="🤷" title="Category not found" body="It may have been deleted." />;

  const routines = data.routines.filter((r) => r.category_id === category.id);
  const addRoutine = () => router.push({ pathname: '/routine-form', params: { categoryId: category.id } });

  return (
    <>
      <Stack.Screen
        options={{
          title: `${category.icon} ${category.name}`,
          headerRight: () => (
            <HeaderButton title="Edit" onPress={() => router.push({ pathname: '/category-form', params: { id: category.id } })} />
          ),
        }}
      />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        {routines.length === 0 ? (
          <EmptyState
            icon={category.icon}
            title="No routines yet"
            body="Add the recurring things that belong here, e.g. Wash dishes every day."
            action={<Button title="Add a routine" onPress={addRoutine} />}
          />
        ) : (
          <>
            <SectionTitle right={<ThemedText type="small" themeColor="textSecondary">week · 30 days</ThemedText>}>
              Routines
            </SectionTitle>
            {routines.map((r) => {
              const week = pct(scoreRoutine(r, data.logIndex, weekStart(now), now));
              const month = pct(scoreRoutine(r, data.logIndex, subDays(now, 29), now));
              const s = streak(r, data.logIndex, now);
              return (
                <Card key={r.id} onPress={() => router.push({ pathname: '/routine-form', params: { id: r.id } })}>
                  <View style={styles.row}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                        {r.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {[describeSchedule(r.schedule), TIME_LABEL[r.time_of_day], s >= 2 ? `🔥 ${s}` : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </ThemedText>
                    </View>
                    {r.assignee_ids.map((id) => (
                      <Avatar key={id} profile={memberById.get(id)?.profile} size={24} />
                    ))}
                    <ScorePill value={week} />
                    <ScorePill value={month} />
                  </View>
                </Card>
              );
            })}
            <Button title="Add routine" variant="secondary" onPress={addRoutine} />
          </>
        )}
      </Screen>
    </>
  );
}
