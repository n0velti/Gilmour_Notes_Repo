import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BW } from '@/constants/monochrome';
import { useAuth } from '@/contexts/auth-context';
import { router } from 'expo-router';

const DESKTOP_WEB_MIN_WIDTH = 768;

function formatAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Supabase is temporarily limiting emails from this project (sign-ups, password resets, etc.). Wait a while and try again. For local testing, turn off “Confirm email” under Authentication → Providers → Email so sign-up does not send mail.';
  }
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials') ||
    (lower.includes('email') && lower.includes('password') && lower.includes('invalid'))
  ) {
    return 'Wrong email or password. Check what you typed, or reset your password in Supabase if you forgot it.';
  }
  if (lower.includes('email not confirmed')) {
    return 'This email is not confirmed yet. Use the link Supabase sent you, or turn off “Confirm email” in the Supabase dashboard for testing.';
  }
  return message;
}

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const { session, signIn, signUp } = useAuth();

  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session]);

  const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_WEB_MIN_WIDTH;

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setMessage(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setMessage('Enter email and password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signIn') {
        const { error } = await signIn(trimmedEmail, password);
        if (error) {
          setMessage(formatAuthError(error.message));
          return;
        }
        router.replace('/');
        return;
      }

      const { error, pendingEmailConfirmation } = await signUp(trimmedEmail, password);
      if (error) {
        setMessage(formatAuthError(error.message));
        return;
      }
      if (pendingEmailConfirmation) {
        setMessage(
          'Confirm the link sent to your email. For instant sign-up with no email step, turn off “Confirm email” under Authentication → Providers → Email in Supabase.'
        );
        return;
      }
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const form = (
    <>
      <Text style={styles.title}>Gilmour Notes</Text>
      <Text style={styles.subtitle}>{mode === 'signIn' ? 'Sign in to continue' : 'Create an account'}</Text>

      <TextInput
        style={[styles.input, isNativeMobile && styles.inputNative]}
        placeholder="Email"
        placeholderTextColor={BW.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, isNativeMobile && styles.inputNative]}
        placeholder="Password"
        placeholderTextColor={BW.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.primaryButton, { opacity: pressed || loading ? 0.85 : 1 }]}
        onPress={onSubmit}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={BW.bg} />
        ) : (
          <Text style={styles.primaryLabel}>{mode === 'signIn' ? 'Sign in' : 'Sign up'}</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.switchMode}
        onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setMessage(null);
        }}>
        <Text style={styles.switchLabel}>
          {mode === 'signIn' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </>
  );

  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;

  if (isDesktopWeb) {
    return (
      <View style={[styles.flex, styles.desktopRoot, { backgroundColor: BW.bg }]}>
        <KeyboardAvoidingView behavior={keyboardBehavior} style={styles.desktopKeyboard}>
          <View
            style={[
              styles.desktopCard,
              Platform.OS === 'web'
                ? ({
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                  } as object)
                : null,
            ]}>
            {form}
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: BW.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior}>
        <View style={[styles.mobileContainer, isNativeMobile && styles.mobileContainerNative]}>{form}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  desktopRoot: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  desktopKeyboard: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  desktopCard: {
    width: '100%',
    maxWidth: 400,
    padding: 28,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.border,
    backgroundColor: BW.bg,
    gap: 12,
  },
  mobileContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  mobileContainerNative: {
    paddingVertical: 8,
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '600',
    color: BW.fg,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 15,
    color: BW.fg,
    opacity: 0.75,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BW.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: BW.fg,
    backgroundColor: BW.bg,
  },
  inputNative: {
    minHeight: 48,
  },
  message: {
    textAlign: 'center',
    fontSize: 14,
    color: BW.fg,
    opacity: 0.9,
  },
  primaryButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: BW.fg,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: BW.bg,
  },
  switchMode: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 15,
    color: BW.fg,
    opacity: 0.8,
  },
});
