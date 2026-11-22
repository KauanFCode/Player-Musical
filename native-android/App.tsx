import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Compass, Library, ListMusic } from 'lucide-react-native';
import { PlayerProvider } from './src/context/PlayerContext';
import { MiniPlayer } from './src/components/MiniPlayer';
import { PlayerModal } from './src/components/PlayerModal';
import { TourOverlay } from './src/components/TourOverlay';
import LibraryScreen from './src/screens/LibraryScreen';
import PlaylistsScreen from './src/screens/PlaylistsScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import { COLORS } from './src/theme/theme';

const Tab = createBottomTabNavigator();

function RootNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            height: 58 + insets.bottom,
            paddingBottom: Math.max(8, insets.bottom),
            paddingTop: 6,
          },
        }}
      >
        <Tab.Screen
          name="Biblioteca"
          component={LibraryScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Library color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Playlists"
          component={PlaylistsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <ListMusic color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Explorar"
          component={ExploreScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Compass color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <SafeAreaProvider>
        <PlayerProvider>
          <RootNavigator />
          <MiniPlayer />
          <PlayerModal />
          <TourOverlay />
        </PlayerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
