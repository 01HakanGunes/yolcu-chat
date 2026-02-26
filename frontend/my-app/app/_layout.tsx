import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import * as Linking from "expo-linking";
import "react-native-reanimated";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { registerGlobals } from "@livekit/react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePushToken } from "@/hooks/use-push-token";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

// Register LiveKit WebRTC polyfills — must run once before any LiveKit code.
// NOTE: AudioSession is NOT started here; it is managed per-room in live.tsx.
registerGlobals();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // 1. Manage Session State
  const [session, setSession] = useState<Session | null>(null);
  const [isMounted, setIsMounted] = useState(false); // Helps avoid "flickering"

  const segments = useSegments();
  const router = useRouter();
  const { registerPushToken } = usePushToken();

  useEffect(() => {
    // 2. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsMounted(true); // App is ready to render
    });

    // 3. Listen for realtime auth changes (login, logout, auto-refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Register push token when user is authenticated
  useEffect(() => {
    if (session?.user) {
      registerPushToken();
    }
  }, [session?.user, registerPushToken]);

  // Handle deep links for invite codes
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      // Parse URL: yolcu://join/CODE or https://yolcuchat.app/join/CODE
      const parsedUrl = Linking.parse(url);

      if (
        parsedUrl.path?.startsWith("join/") ||
        parsedUrl.hostname === "join"
      ) {
        const code =
          parsedUrl.path?.replace("join/", "") || parsedUrl.queryParams?.code;

        if (code && session) {
          // Call RPC to join room
          const { data, error } = await supabase.rpc("join_room_via_code", {
            code_input: code,
          });

          if (error) {
            Alert.alert("Error", "Failed to join room. Please try again.");
            return;
          }

          if (data?.status === "error") {
            Alert.alert("Error", data.message || "Invalid invite code");
            return;
          }

          if (data?.room_id) {
            // Navigate to the room
            router.push(`/room/${data.room_id}`);
          }
        } else if (code && !session) {
          Alert.alert("Error", "Please sign in to join a room");
        }
      }
    };

    // Handle URL when app is already open
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    // Handle URL when app is opened from closed state
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [session, router]);

  useEffect(() => {
    if (!isMounted) return;

    // 4. The "Auth Guard" Logic
    // Check if the user is currently in the (auth) group
    const inAuthGroup = segments[0] === "(auth)";

    if (session && inAuthGroup) {
      // User IS logged in, but is on Login/Signup page -> Kick them to Home
      router.replace("/");
    } else if (!session && !inAuthGroup) {
      // User is NOT logged in, but is trying to access the App -> Kick them to Login
      router.replace("/(auth)/sign-in");
    }
  }, [session, segments, isMounted, router]);

  // 5. Show a loading spinner while we check the session (prevents flickering)
  if (!isMounted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <KeyboardProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          {/* Main App (Tabs) */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* Auth Screens (Login/Signup) */}
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />

          {/* Chat Screens - has its own Stack with headers */}
          <Stack.Screen name="(chat)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </KeyboardProvider>
  );
}
