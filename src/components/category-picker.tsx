import { View } from 'react-native';

import { Chip, Field, Label, styles } from '@/components/ui';
import { Spacing } from '@/constants/theme';

/** "new" = a category typed in the form, created when it's saved. */
export const NEW_CATEGORY = 'new';

/**
 * Pick a category for a routine or to-do, or type a new one, so creating never takes two steps.
 * Icons are assigned automatically from the name.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  newName,
  onNewName,
  placeholder,
}: {
  categories: { id: string; name: string; icon: string }[];
  value: string;
  onChange: (id: string) => void;
  newName: string;
  onNewName: (name: string) => void;
  placeholder: string;
}) {
  return (
    <View style={{ gap: Spacing.two }}>
      <Label>Category</Label>
      <View style={styles.wrap}>
        {categories.map((c) => (
          <Chip key={c.id} label={`${c.icon} ${c.name}`} selected={value === c.id} onPress={() => onChange(c.id)} />
        ))}
        <Chip label="＋ New" selected={value === NEW_CATEGORY} onPress={() => onChange(NEW_CATEGORY)} />
      </View>
      {value === NEW_CATEGORY && (
        <Field label="New category" value={newName} onChangeText={onNewName} placeholder={placeholder} />
      )}
    </View>
  );
}
