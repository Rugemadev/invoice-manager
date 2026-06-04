import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { borderTopColor: Colors.border, backgroundColor: Colors.surface },
        tabBarLabelStyle: { fontSize: 8, fontWeight: '600' },
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: t('tabs.invoices'),
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: t('tabs.clients'),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t('tabs.reports'),
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
