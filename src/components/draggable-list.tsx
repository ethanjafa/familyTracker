import { type ReactNode, useRef } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** How long to hold a row before it can be dragged (a quick tap still taps). */
const HOLD_MS = 300;

/**
 * A list you reorder by holding a row and dragging it. Rows can have different heights.
 * `onReorder` gets the keys in their new order once a row is dropped.
 */
export function DraggableList<T>({
  items,
  keyOf,
  renderItem,
  onReorder,
}: {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (keys: string[]) => void;
}) {
  const active = useSharedValue(-1);
  const hover = useSharedValue(-1);
  const offset = useSharedValue(0);
  const heights = useSharedValue<number[]>([]);
  // Row heights are collected here on the JS side and sent to the gesture as a whole. Reading the
  // shared value back on JS can return a stale copy, which made rows overwrite each other's heights.
  const measured = useRef<number[]>([]);

  const setHeight = (index: number, height: number) => {
    if (measured.current[index] === height) return;
    measured.current[index] = height;
    heights.set([...measured.current]);
  };

  const drop = (from: number, to: number) => {
    if (to >= 0 && to !== from) {
      const keys = items.map(keyOf);
      const [moved] = keys.splice(from, 1);
      keys.splice(to, 0, moved);
      onReorder(keys);
    }
    // Let React render the new order before the rows stop being shifted.
    requestAnimationFrame(() => {
      active.set(-1);
      hover.set(-1);
      offset.set(0);
    });
  };

  return (
    <View>
      {items.map((item, i) => (
        <DragRow
          key={keyOf(item)}
          index={i}
          count={items.length}
          active={active}
          hover={hover}
          offset={offset}
          heights={heights}
          onHeight={setHeight}
          onDrop={drop}>
          {renderItem(item, i)}
        </DragRow>
      ))}
    </View>
  );
}

function DragRow({
  index,
  count,
  active,
  hover,
  offset,
  heights,
  onHeight,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  active: SharedValue<number>;
  hover: SharedValue<number>;
  offset: SharedValue<number>;
  heights: SharedValue<number[]>;
  onHeight: (index: number, height: number) => void;
  onDrop: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const pan = usePanGesture({
    activateAfterLongPress: HOLD_MS,
    onActivate: () => {
      'worklet';
      active.set(index);
      hover.set(index);
      offset.set(0);
    },
    onUpdate: (e) => {
      'worklet';
      offset.set(e.translationY);
      // Which slot the middle of the dragged row is over now.
      const h = heights.get();
      let top = 0;
      for (let k = 0; k < index; k++) top += h[k] ?? 0;
      const middle = top + (h[index] ?? 0) / 2 + e.translationY;
      let y = 0;
      let target = count - 1;
      for (let k = 0; k < count; k++) {
        y += h[k] ?? 0;
        if (middle < y) {
          target = k;
          break;
        }
      }
      hover.set(Math.max(0, target));
    },
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(onDrop, index, hover.get());
    },
  });

  const style = useAnimatedStyle(() => {
    const dragged = active.get();
    if (dragged === index) {
      return { transform: [{ translateY: offset.get() }, { scale: 1.02 }], zIndex: 10, opacity: 0.92 };
    }
    if (dragged < 0) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, opacity: 1 };
    // Rows between the dragged row's old and new slot move over to make room.
    const room = heights.get()[dragged] ?? 0;
    const to = hover.get();
    const shift = dragged < index && index <= to ? -room : dragged > index && index >= to ? room : 0;
    return { transform: [{ translateY: withTiming(shift, { duration: 150 }) }, { scale: 1 }], zIndex: 0, opacity: 1 };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style} onLayout={(e) => onHeight(index, e.nativeEvent.layout.height)}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
