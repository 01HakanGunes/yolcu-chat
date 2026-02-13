import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function CreateRoomScreen() {
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  // --- THEME COLORS ---
  const textColor = useThemeColor({}, "text");
  const inputBgColor = useThemeColor(
    { light: "#f0f0f0", dark: "#1c1c1e" },
    "background",
  );
  const placeholderColor = useThemeColor(
    { light: "#999", dark: "#666" },
    "icon",
  );
  const accentColor = "#0a7ea4";

  const createRoom = async () => {
    if (!roomName.trim() || creating) return;

    setCreating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Error", "You must be logged in to create a room");
      setCreating(false);
      return;
    }

    // Create the room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        name: roomName.trim(),
        created_by: user.id,
      })
      .select()
      .single();

    if (roomError) {
      console.error("Error creating room:", roomError);
      Alert.alert("Error", "Failed to create room. Please try again.");
      setCreating(false);
      return;
    }

    // Add creator as a member
    const { error: memberError } = await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: user.id,
    });

    if (memberError) {
      console.error("Error adding member:", memberError);
      // Room was created but member wasn't added - still navigate
    }

    setCreating(false);
    // Navigate to the new room
    router.replace(`/room/${room.id}`);
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.content} behavior="padding">
        <ThemedText style={styles.label}>Room Name</ThemedText>
        <TextInput
          style={[
            styles.input,
            { color: textColor, backgroundColor: inputBgColor },
          ]}
          placeholder="Enter room name..."
          placeholderTextColor={placeholderColor}
          value={roomName}
          onChangeText={setRoomName}
          autoFocus
          maxLength={50}
        />

        <TouchableOpacity
          style={[
            styles.createButton,
            { backgroundColor: accentColor },
            (!roomName.trim() || creating) && styles.disabledButton,
          ]}
          onPress={createRoom}
          disabled={!roomName.trim() || creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.createButtonText}>Create Room</ThemedText>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    opacity: 0.7,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 24,
  },
  createButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
