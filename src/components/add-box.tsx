import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamilies, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A text box with a square "+" beside it: type and press "+" (or Done) to add. Used at the top of
 * the grocery list and of Routines, so adding looks the same everywhere.
 */
export function AddBox({
  value,
  onChangeText,
  onAdd,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  const theme = useTheme();
  return (
    <View style={local.row}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onAdd}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.tint}
        returnKeyType="done"
        style={[local.input, { backgroundColor: theme.backgroundElement, color: theme.text, fontFamily: FontFamilies[500] }]}
      />
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add"
        style={({ pressed }) => [local.add, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText style={{ color: theme.onTint, fontWeight: 800, fontSize: 22, lineHeight: 26 }}>+</ThemedText>
      </Pressable>
    </View>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { flex: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 14, fontSize: 16 },
  add: { width: 50, height: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
