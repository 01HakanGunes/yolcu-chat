import { Stack } from "expo-router";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function ChatLayout() {
  const colorScheme = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors[colorScheme ?? "light"].background,
        },
        headerTintColor: Colors[colorScheme ?? "light"].tint,
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Stack.Screen
        name="create_room"
        options={{
          title: "Create Room",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="room/[id]/index"
        options={{
          title: "Chat",
        }}
      />
      <Stack.Screen
        name="room/[id]/settings"
        options={{
          title: "Room Settings",
        }}
      />
      <Stack.Screen
        name="room/[id]/live"
        options={{
          title: "Live Session",
          presentation: "fullScreenModal",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
