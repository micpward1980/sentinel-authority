import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/styles/theme';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ApplicationsScreen from './src/screens/ApplicationsScreen';
import ApplicationDetailScreen from './src/screens/ApplicationDetailScreen';
import NewApplicationScreen from './src/screens/NewApplicationScreen';
import CertificatesScreen from './src/screens/CertificatesScreen';
import AgentScreen from './src/screens/AgentScreen';
import CAT72Screen from './src/screens/CAT72Screen';
import MonitoringScreen from './src/screens/MonitoringScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsSettingsScreen from './src/screens/NotificationsSettingsScreen';
import SecuritySettingsScreen from './src/screens/SecuritySettingsScreen';
import OrganizationSettingsScreen from './src/screens/OrganizationSettingsScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.bgDeep },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '600' },
  contentStyle: { backgroundColor: colors.bgDeep },
};

const tabBarStyle = {
  backgroundColor: colors.bgCard,
  borderTopColor: colors.borderSubtle,
  paddingBottom: 5,
  height: 60,
};

function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Applications') iconName = focused ? 'documents' : 'documents-outline';
          else if (route.name === 'Certificates') iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
          else if (route.name === 'Agent') iconName = focused ? 'cube' : 'cube-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.purpleBright,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle,
        headerStyle: { backgroundColor: colors.bgDeep },
        headerTintColor: colors.textPrimary,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Applications" component={ApplicationsScreen} />
      <Tab.Screen name="Certificates" component={CertificatesScreen} />
      <Tab.Screen name="Agent" component={AgentScreen} options={{ title: 'ENVELO Agent' }} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Applications') iconName = focused ? 'documents' : 'documents-outline';
          else if (route.name === 'CAT72') iconName = focused ? 'flask' : 'flask-outline';
          else if (route.name === 'Certificates') iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
          else if (route.name === 'Monitoring') iconName = focused ? 'pulse' : 'pulse-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.purpleBright,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle,
        headerStyle: { backgroundColor: colors.bgDeep },
        headerTintColor: colors.textPrimary,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Applications" component={ApplicationsScreen} />
      <Tab.Screen name="CAT72" component={CAT72Screen} options={{ title: 'CAT-72' }} />
      <Tab.Screen name="Certificates" component={CertificatesScreen} />
      <Tab.Screen name="Monitoring" component={MonitoringScreen} />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>SENTINEL AUTHORITY</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={user.role === 'admin' ? AdminTabs : CustomerTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="ApplicationDetail" component={ApplicationDetailScreen} options={{ title: 'Application' }} />
          <Stack.Screen name="NewApplication" component={NewApplicationScreen} options={{ title: 'New Application' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="NotificationsSettings" component={NotificationsSettingsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} options={{ title: 'Security' }} />
          <Stack.Screen name="OrganizationSettings" component={OrganizationSettingsScreen} options={{ title: 'Organization' }} />
          <Stack.Screen name="UserManagement" component={UserManagementScreen} options={{ title: 'Users' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <MainNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.purpleBright,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
