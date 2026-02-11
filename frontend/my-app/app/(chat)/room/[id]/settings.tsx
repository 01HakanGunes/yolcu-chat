import { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";
import { useThemeColor } from "@/hooks/use-theme-color";

type Member = {
  user_id: string;
  joined_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type RoomDetails = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
};

export default function RoomSettingsScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // --- THEME COLORS ---
  const borderColor = useThemeColor(
    { light: "#E5E5EA", dark: "#333333" },
    "background",
  );
  const inputBgColor = useThemeColor(
    { light: "#f0f0f0", dark: "#1c1c1e" },
    "background",
  );
  const dangerColor = "#dc3545";
  const accentColor = "#0a7ea4";

  const isCreator = currentUserId === room?.created_by;

  const fetchData = useCallback(async () => {
    if (!roomId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);

    // Fetch room details
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, invite_code, created_by")
      .eq("id", roomId)
      .single();

    if (!roomError && roomData) {
      setRoom(roomData);
    }

    // Fetch members
    const { data: membersData, error: membersError } = await supabase
      .from("room_members")
      .select("user_id, joined_at")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

    if (!membersError && membersData && membersData.length > 0) {
      // Fetch profiles for all members
      const userIds = membersData.map((m) => m.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);

      // Combine members with their profiles
      const formattedMembers = membersData.map((m) => ({
        ...m,
        profiles: profilesData?.find((p) => p.id === m.user_id) || null,
      }));
      setMembers(formattedMembers as Member[]);
    }

    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const shareInviteCode = async () => {
    if (!room?.invite_code) return;

    try {
      await Share.share({
        message: `Join "${room.name}" on Yolcu Chat!\n\nyolcu://join/${room.invite_code}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleKickMember = (memberId: string, memberName: string | null) => {
    Alert.alert(
      "Remove Member",
      `Remove ${memberName || "this user"} from the room?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            const { error } = await supabase.rpc("kick_member", {
              room_id: roomId,
              target_user_id: memberId,
            });

            if (error) {
              Alert.alert("Error", "Failed to remove member");
            } else {
              fetchData();
            }
            setActionLoading(false);
          },
        },
      ],
    );
  };

  const handleLeaveRoom = () => {
    Alert.alert("Leave Room", "Are you sure you want to leave this room?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          const { error } = await supabase.rpc("leave_room", {
            room_id: roomId,
          });

          if (error) {
            Alert.alert("Error", "Failed to leave room");
            setActionLoading(false);
          } else {
            router.dismissAll();
            router.replace("/");
          }
        },
      },
    ]);
  };

  const handleDeleteRoom = () => {
    Alert.alert(
      "Delete Room",
      "Delete this room? All messages will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            const { error } = await supabase.rpc("delete_room", {
              room_id: roomId,
            });

            if (error) {
              Alert.alert("Error", "Failed to delete room");
              setActionLoading(false);
            } else {
              router.dismissAll();
              router.replace("/");
            }
          },
        },
      ],
    );
  };

  const renderMember = ({ item }: { item: Member }) => {
    const isItemCreator = item.user_id === room?.created_by;
    const isCurrentUser = item.user_id === currentUserId;
    const displayName = item.profiles?.display_name || "Unknown";

    return (
      <View style={[styles.memberItem, { borderBottomColor: borderColor }]}>
        <View style={[styles.avatar, { backgroundColor: borderColor }]}>
          <ThemedText style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.memberInfo}>
          <ThemedText style={styles.memberName}>
            {displayName}
            {isCurrentUser && " (You)"}
          </ThemedText>
          {isItemCreator && (
            <ThemedText style={[styles.creatorBadge, { color: accentColor }]}>
              Creator
            </ThemedText>
          )}
        </View>
        {isCreator && !isItemCreator && (
          <TouchableOpacity
            style={[styles.kickButton, { backgroundColor: dangerColor }]}
            onPress={() => handleKickMember(item.user_id, displayName)}
            disabled={actionLoading}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={accentColor} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Invite Code Section */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>INVITE CODE</ThemedText>
        <View
          style={[
            styles.inviteCodeBox,
            { backgroundColor: inputBgColor, borderColor },
          ]}
        >
          <ThemedText style={styles.inviteCode}>{room?.invite_code}</ThemedText>
          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: accentColor }]}
            onPress={shareInviteCode}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Members Section */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>
          MEMBERS ({members.length})
        </ThemedText>
        <View style={[styles.membersList, { borderColor }]}>
          <FlatList
            data={members}
            renderItem={renderMember}
            keyExtractor={(item) => item.user_id}
            scrollEnabled={false}
          />
        </View>
      </View>

      {/* Actions Section */}
      <View style={styles.section}>
        {!isCreator && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.leaveButton,
              { borderColor: dangerColor },
            ]}
            onPress={handleLeaveRoom}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={dangerColor} />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color={dangerColor} />
                <ThemedText
                  style={[styles.actionButtonText, { color: dangerColor }]}
                >
                  Leave Room
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        )}

        {isCreator && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.deleteButton,
              { backgroundColor: dangerColor },
            ]}
            onPress={handleDeleteRoom}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <ThemedText
                  style={[styles.actionButtonText, { color: "#fff" }]}
                >
                  Delete Room
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.5,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inviteCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inviteCode: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 2,
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  membersList: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
  },
  creatorBadge: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  kickButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  leaveButton: {
    borderWidth: 1,
  },
  deleteButton: {},
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
