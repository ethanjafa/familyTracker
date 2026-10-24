import { NativeTabs } from 'expo-router/native-tabs';

import { FontFamilies } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const colors = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.card}
      tintColor={colors.tint}
      indicatorColor={colors.tintSoft}
      iconColor={{ default: colors.textSecondary, selected: colors.tint }}
      labelStyle={{
        default: { color: colors.textSecondary, fontFamily: FontFamilies[600] },
        selected: { color: colors.tint, fontFamily: FontFamilies[700] },
      }}>
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checkmark.circle" md="check_circle" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="routines">
        <NativeTabs.Trigger.Label>Routines</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="repeat" md="repeat" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="projects">
        <NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="hammer" md="construction" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scorecard">
        <NativeTabs.Trigger.Label>Scorecard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="family">
        <NativeTabs.Trigger.Label>Family</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2" md="group" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
