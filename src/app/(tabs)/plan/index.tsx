import { addWeeks } from 'date-fns';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { PlanTable } from '@/components/plan/plan-table';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen, Segmented } from '@/components/ui';
import { useRoutineData } from '@/hooks/use-routine-data';
import { weekDays, weekStart } from '@/lib/dates';
import { getFlag, setFlag } from '@/lib/device-flags';

type Week = 'this' | 'next';

const HINT_FLAG = 'plan-tap-hint-seen';

/**
 * Assign: who does what this week or next. Planning itself is the "Plan the week together" task
 * on Today; meals and groceries are on Today's dashboard.
 */
export default function PlanScreen() {
  const data = useRoutineData();
  const [week, setWeek] = useState<Week>('this');
  // A one-time tip the first time someone opens Plan on this device.
  const [showHint, setShowHint] = useState(() => !getFlag(HINT_FLAG));

  const start = addWeeks(weekStart(new Date()), week === 'next' ? 1 : 0);
  const dismissHint = () => {
    setFlag(HINT_FLAG);
    setShowHint(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Assign' }} />
      <Screen onRefresh={data.refetch} refreshing={data.isRefetching}>
        {showHint && (
          <Card style={{ gap: 10 }}>
            <ThemedText type="smallBold" style={{ fontSize: 16 }}>
              👆 Tap a box to choose who does it
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Each tap moves the task to the next person in your family. Keep tapping to take it off that day, and once more to
              bring it back. Changes only apply to the week you&apos;re looking at.
            </ThemedText>
            <Button title="Got it" variant="secondary" onPress={dismissHint} />
          </Card>
        )}
        <Segmented
          options={[
            { value: 'this', label: 'This week' },
            { value: 'next', label: 'Next week' },
          ]}
          value={week}
          onChange={setWeek}
        />
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          👆 Tap a box to assign who does it · tap again to switch person
        </ThemedText>
        <PlanTable days={weekDays(start)} />
      </Screen>
    </>
  );
}
