import { memo, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BW } from '@/constants/monochrome';

const DEFAULT_SIZE = 34;
const STROKE = 2.5;
const TRACK = 'rgba(0,0,0,0.1)';
const GREEN = '#15803d';
const RED = '#c41e1e';

type Props = {
  /** When false, show “i” affordance; when true, show ring + days in circle */
  hasDue: boolean;
  /** Calendar days: positive = due in N days, 0 = today, negative = N days overdue */
  dueDeltaDays: number;
  /** 0–1 remaining “battery” in the due window (ignored when overdue) */
  progress: number;
  onPress: () => void;
  size?: number;
  /** Merged onto the outer row wrapper (e.g. `{ marginTop: 0 }` when inline with one line). */
  style?: StyleProp<ViewStyle>;
};

function NoteDueIndicatorInner({
  hasDue,
  dueDeltaDays,
  progress,
  onPress,
  size = DEFAULT_SIZE,
  style,
}: Props) {
  const stroke = size < 44 ? 2 : STROKE;
  const overdue = dueDeltaDays < 0;
  const isDueToday = dueDeltaDays === 0;
  const accent = overdue ? RED : isDueToday ? BW.fg : GREEN;

  const { label, fontSize, ringProgress } = useMemo(() => {
    /** Slightly smaller glyphs than raw scale so the number sits centered in the ring. */
    const fs = (n: number) =>
      Math.round(n * (size / DEFAULT_SIZE) * 0.92);
    if (overdue) {
      const n = Math.min(999, Math.abs(dueDeltaDays));
      const s = n > 99 ? '99+' : String(n);
      return {
        label: s,
        fontSize: fs(s.length >= 3 ? 9 : s.length >= 2 ? 10 : 12),
        ringProgress: 1,
      };
    }
    const n = Math.min(999, Math.max(0, dueDeltaDays));
    const s = n > 99 ? '99+' : String(n);
    return {
      label: s,
      fontSize: fs(s.length >= 3 ? 9 : s.length >= 2 ? 10 : 12),
      ringProgress: Math.max(0, Math.min(1, progress)),
    };
  }, [dueDeltaDays, overdue, progress, size]);

  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const p = ringProgress;
  const dashOffset = c * (1 - p);

  const glyphFont = Math.max(9, Math.round(size * 0.33));

  if (!hasDue) {
    return (
      <View style={[styles.wrap, style]}>
        <Pressable
          style={({ pressed }) => [
            styles.glyphWrap,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
            pressed && { opacity: 0.55 },
          ]}
          onPress={onPress}
          accessibilityLabel="Note details"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <View style={styles.glyphCenterFill} pointerEvents="none">
            <Text
              style={[
                styles.glyph,
                {
                  fontSize: glyphFont,
                  lineHeight: glyphFont,
                  textAlign: 'center',
                  ...(Platform.OS === 'android'
                    ? { includeFontPadding: false, textAlignVertical: 'center' }
                    : {}),
                },
              ]}>
              i
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  const a11y = overdue
    ? `Note details, overdue by ${Math.abs(dueDeltaDays)} days`
    : isDueToday
      ? 'Note details, due today'
      : `Note details, due in ${dueDeltaDays} days`;

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        style={({ pressed }) => [styles.ringPress, pressed && { opacity: 0.88 }]}
        onPress={onPress}
        accessibilityLabel={a11y}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              stroke={TRACK}
              strokeWidth={stroke}
              fill="none"
            />
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              stroke={accent}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          </Svg>
          <View style={styles.centerLabel} pointerEvents="none">
            <Text
              style={[
                styles.innerNumber,
                {
                  color: accent,
                  fontSize,
                  lineHeight: fontSize,
                },
              ]}
              numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export const NoteDueIndicator = memo(NoteDueIndicatorInner);

const styles = StyleSheet.create({
  /** Single control: center in parent (note row column). */
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  glyphWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.borderSoft,
    backgroundColor: BW.bg,
    overflow: 'hidden',
  },
  glyphCenterFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontWeight: '600',
    color: BW.muted,
    textAlign: 'center',
  },
  ringPress: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  centerLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 2,
  },
  innerNumber: {
    fontWeight: '700',
    width: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
});
