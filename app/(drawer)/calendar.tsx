import { ScrollView, StyleSheet, Text } from 'react-native';

import { BW } from '@/constants/monochrome';

export default function CalendarScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Calendar</Text>
      <Text style={styles.body}>Your schedule will appear here.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: BW.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: BW.fg,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: BW.fg,
    lineHeight: 24,
    opacity: 0.85,
  },
});
