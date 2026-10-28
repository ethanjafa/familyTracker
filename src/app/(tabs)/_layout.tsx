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
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Label>Routines</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="target" md="flag" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scorecard">
        <NativeTabs.Trigger.Label>Scorecard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
