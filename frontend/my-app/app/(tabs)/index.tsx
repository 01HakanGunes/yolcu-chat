import { useState, useCallback } from "react";
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  View,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";
import { useThemeColor } from "@/hooks/use-theme-color";

type Room = {
  id: string;
  name: string;
  created_at: string;
};

export default function RoomsListScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const router = useRouter();

  // --- THEME COLORS ---
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor(
    { light: "#E5E5EA", dark: "#333333" },
    "background",
  );
  const inputBgColor = useThemeColor(
    { light: "#f0f0f0", dark: "#1c1c1e" },
    "background",
  );
  const placeholderColor = useThemeColor(
    { light: "#999", dark: "#666" },
    "icon",
  );
  const accentColor = "#0a7ea4";

  useFocusEffect(
    useCallback(() => {
      fetchRooms();
    }, []),
  );

  const fetchRooms = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("room_members")
      .select("room_id, rooms(id, name, created_at)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });

    if (error) {
      console.error("Error fetching rooms:", error);
    } else {
      const roomsList: Room[] = [];
      data?.forEach((item) => {
        if (item.rooms && !Array.isArray(item.rooms)) {
          roomsList.push(item.rooms as Room);
        }
      });
      setRooms(roomsList);
    }
    setLoading(false);
  };

  const navigateToRoom = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  const navigateToCreateRoom = () => {
    router.push("/create_room");
  };

  const joinRoomWithCode = async () => {
    if (!inviteCode.trim() || joining) return;

    setJoining(true);

    const { data, error } = await supabase.rpc("join_room_via_code", {
      code_input: inviteCode.trim(),
    });

    if (error) {
      Alert.alert("Error", "Failed to join room. Please try again.");
      setJoining(false);
      return;
    }

    if (data?.status === "error") {
      Alert.alert("Error", data.message || "Invalid invite code");
      setJoining(false);
      return;
    }

    if (data?.room_id) {
      setInviteCode("");
      setJoining(false);
      fetchRooms();
      router.push(`/room/${data.room_id}`);
    }
  };

  const renderRoom = ({ item }: { item: Room }) => {
    return (
      <TouchableOpacity
        style={[styles.roomItem, { borderBottomColor: borderColor }]}
        onPress={() => navigateToRoom(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.roomIcon, { backgroundColor: accentColor }]}>
          <Ionicons name="chatbubbles" size={20} color="#fff" />
        </View>
        <View style={styles.roomInfo}>
          <ThemedText style={styles.roomName}>{item.name}</ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={borderColor} />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color={borderColor} />
      <ThemedText style={styles.emptyText}>
        {"You haven't joined any rooms yet"}
      </ThemedText>
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: accentColor }]}
        onPress={navigateToCreateRoom}
      >
        <ThemedText style={styles.createButtonText}>Create a Room</ThemedText>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={accentColor} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Rooms</ThemedText>
        <TouchableOpacity
          style={styles.addButton}
          onPress={navigateToCreateRoom}
        >
          <Ionicons name="add-circle" size={28} color={accentColor} />
        </TouchableOpacity>
      </ThemedView>

      <View style={[styles.joinCodeContainer, { borderBottomColor: borderColor }]}>
        <TextInput
          style={[
            styles.codeInput,
            { color: textColor, backgroundColor: inputBgColor },
          ]}
          placeholder="Enter invite code..."
          placeholderTextColor={placeholderColor}
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[
            styles.joinButton,
            { backgroundColor: accentColor },
            (!inviteCode.trim() || joining) && styles.disabledButton,
          ]}
          onPress={joinRoomWithCode}
          disabled={!inviteCode.trim() || joining}
        >
          {joining ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="enter-outline" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={rooms}
        renderItem={renderRoom}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          rooms.length === 0 ? styles.emptyList : undefined
        }
        ListEmptyComponent={renderEmptyState}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150,150,150,0.2)",
  },
  addButton: {
    padding: 4,
  },
  joinCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  codeInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
  },
  joinButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  roomItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
    opacity: 0.6,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
