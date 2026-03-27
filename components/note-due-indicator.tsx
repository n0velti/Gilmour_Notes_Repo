import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BW } from '@/constants/monochrome';

const DEFAULT_SIZE = 28;
const STROKE = 2.5;

type Props = {
  /** When false, show “i” affordance; when true, show ring + days */
  hasDue: boolean;
  daysLeft: number;
  /** 0–1 remaining “battery” in the due window */
  progress: number;
  onPress: () => void;
  size?: number;
};

function NoteDueIndicatorInner({
  hasDue,
  daysLeft,
  progress,
  onPress,
  size = DEFAULT_SIZE,
}: Props) {
  const r = (size - STROKE) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const dashOffset = c * (1 - p);

  const label =
    daysLeft > 99 ? '99+' : String(Math.max(0, Math.min(999, daysLeft)));

  if (!hasDue) {
    return (
      <Pressable
        style={({ pressed }) => [styles.glyphWrap, pressed && { opacity: 0.55 }]}
        onPress={onPress}
        accessibilityLabel="Set due date"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.glyph}>i</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.ringPress, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      accessibilityLabel={`Due in ${daysLeft} days`}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={BW.hairline}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={BW.fg}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        </Svg>
        <View style={styles.daysCenter} pointerEvents="none">
          <Text style={styles.daysText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const NoteDueIndicator = memo(NoteDueIndicatorInner);

const styles = StyleSheet.create({
  glyphWrap: {
    marginTop: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BW.bg,
  },
  glyph: {
    fontSize: 13,
    fontWeight: '600',
    color: BW.muted,
    lineHeight: 16,
  },
  ringPress: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysText: {
    fontSize: 9,
    fontWeight: '700',
    color: BW.fg,
    textAlign: 'center',
  },
});
