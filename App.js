import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Loading } from './src/components/ui';
import { colors } from './src/theme';

import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import SignUpScreen from './src/screens/auth/SignUpScreen';
import VerifyScreen from './src/screens/auth/VerifyScreen';
import MatchesScreen from './src/screens/main/MatchesScreen';
import LeaderboardScreen from './src/screens/main/LeaderboardScreen';
import FriendsScreen from './src/screens/main/FriendsScreen';
import AccountScreen from './src/screens/main/AccountScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, border: colors.border, primary: colors.green },
};

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Verify" component={VerifyScreen} />
    </Stack.Navigator>
  );
}

const ICONS = {
  Matches: ['football', 'football-outline'],
  Leaderboard: ['trophy', 'trophy-outline'],
  Friends: ['people', 'people-outline'],
  Account: ['person', 'person-outline'],
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Matches" component={MatchesScreen} options={{ title: 'المباريات' }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'المتصدرون' }} />
      <Tab.Screen name="Friends" component={FriendsScreen} options={{ title: 'الأصدقاء' }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ title: 'حسابي' }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  return (
    <NavigationContainer theme={theme}>
      {session ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
