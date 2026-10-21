import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, font, radius, shadow, space } from '@/theme';

// ---------------- Text ----------------
type Variant = 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label';
const variants: Record<Variant, TextStyle> = {
  h1: { fontFamily: font.bold, fontSize: 26, lineHeight: 34, color: colors.text },
  h2: { fontFamily: font.semibold, fontSize: 20, lineHeight: 28, color: colors.text },
  h3: { fontFamily: font.semibold, fontSize: 17, lineHeight: 24, color: colors.text },
  title: { fontFamily: font.semibold, fontSize: 15, lineHeight: 21, color: colors.text },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  bodyStrong: { fontFamily: font.medium, fontSize: 14, lineHeight: 21, color: colors.text },
  small: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 18, color: colors.textMuted },
  caption: { fontFamily: font.regular, fontSize: 11, lineHeight: 15, color: colors.textFaint },
  label: { fontFamily: font.medium, fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
};

export function Text({ variant = 'body', style, color, ...p }: TextProps & { variant?: Variant; color?: string }) {
  return <RNText {...p} style={[variants[variant], color ? { color } : null, style]} />;
}

// ---------------- Layout ----------------
export function Screen({ children, edges = ['top'], style }: { children: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Header({ title, right, onBack, subtitle }: { title: string; subtitle?: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <View style={s.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Peeche jaayein"
        hitSlop={12}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={s.headerBtn}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="h3" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({ children, gap = space.sm, style, align = 'center' }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; align?: ViewStyle['alignItems'] }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg, marginTop: space.xl, marginBottom: space.md }}>
      <Text variant="h3">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="label" color={colors.primaryDark}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

// ---------------- Buttons ----------------
type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export function Button({
  title,
  onPress,
  kind = 'primary',
  loading,
  disabled,
  icon,
  size = 'lg',
  style,
  ...rest
}: {
  title: string;
  onPress?: () => void;
  kind?: BtnKind;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
} & Omit<PressableProps, 'style' | 'onPress'>) {
  const bg = { primary: colors.primary, secondary: colors.primarySoft, ghost: 'transparent', danger: colors.danger, success: colors.success }[kind];
  const fg = { primary: colors.white, secondary: colors.primaryDark, ghost: colors.primaryDark, danger: colors.white, success: colors.white }[kind];
  const h = { sm: 34, md: 42, lg: 52 }[size];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: h,
          borderRadius: size === 'sm' ? radius.pill : radius.md,
          backgroundColor: bg,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
          borderWidth: kind === 'ghost' ? 1.5 : 0,
          borderColor: colors.primaryTint,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={fg} /> : null}
          <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: size === 'sm' ? 13 : 15, color: fg, flexShrink: 1 }}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, badge, label }: { name: keyof typeof Ionicons.glyphMap; onPress?: () => void; badge?: number; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={s.iconBtn}>
      <Ionicons name={name} size={21} color={colors.text} />
      {badge ? (
        <View style={s.badge}>
          <Text style={{ fontFamily: font.semibold, fontSize: 9.5, color: colors.white }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------- Inputs ----------------
export function Input({ label, error, left, style, ...p }: TextInputProps & { label?: string; error?: string; left?: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View style={[s.input, error ? { borderColor: colors.danger } : null]}>
        {left}
        <TextInput placeholderTextColor={colors.textFaint} style={[s.inputText, style]} {...p} />
      </View>
      {error ? (
        <Text variant="small" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[s.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? colors.white : colors.textMuted} /> : null}
      <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: active ? colors.white : colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segment}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segmentItem, on && s.segmentOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 13, color: on ? colors.primaryDark : colors.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------- States ----------------
export function Loader({ label }: { label?: string }) {
  return (
    <View style={{ padding: space.xxl, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text variant="small">{label}</Text> : null}
    </View>
  );
}

export function Empty({ icon = 'sparkles-outline', title, text, action, onAction }: { icon?: keyof typeof Ionicons.glyphMap; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: 8 }}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {text ? (
        <Text variant="small" style={{ textAlign: 'center', maxWidth: 280 }}>
          {text}
        </Text>
      ) : null}
      {action ? <Button title={action} onPress={onAction} size="md" style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ margin: space.lg, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.dangerSoft, gap: 8 }}>
      <Text variant="bodyStrong" color={colors.danger}>
        {message}
      </Text>
      {onRetry ? <Button title="Dobara koshish karein" kind="ghost" size="sm" onPress={onRetry} style={{ alignSelf: 'flex-start' }} /> : null}
    </View>
  );
}

export function DemoBadge() {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: '#EEE8FF', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontFamily: font.medium, fontSize: 11, color: '#5B3FD1' }}>Demo data · API key set karne par asli</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.bg },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow.card },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, minHeight: 50 },
  // Web par browser ka default focus box nahi (container ka border hi focus dikhata hai)
  inputText: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.text, paddingVertical: 12, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, height: 34, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface, ...shadow.card },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
