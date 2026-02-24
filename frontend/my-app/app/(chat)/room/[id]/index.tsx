// Chat room screen - displays messages for a specific room

import {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
  Share,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";
import { useThemeColor } from "@/hooks/use-theme-color";

type MessageWithProfile = {
  id: string;
  content: string;
  user_id: string;
  room_id: string;
  created_at: string;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

// --- FILE ATTACHMENT COMPONENT ---
function FileAttachment({
  filePath,
  fileType,
  fileName,
  isOwn,
  textColor,
}: {
  filePath: string;
  fileType: string | null;
  fileName: string | null;
  isOwn: boolean;
  textColor: string;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage
      .from("chat-files")
      .createSignedUrl(filePath, 3600)
      .then(({ data }) => {
        if (data) setSignedUrl(data.signedUrl);
      });
  }, [filePath]);

  const isImage = fileType?.startsWith("image/");
  const iconColor = isOwn ? "#fff" : textColor;

  if (!signedUrl) {
    return (
      <ActivityIndicator
        size="small"
        color={iconColor}
        style={{ marginVertical: 8 }}
      />
    );
  }

  if (isImage) {
    return (
      <TouchableOpacity onPress={() => Linking.openURL(signedUrl)}>
        <Image
          source={{ uri: signedUrl }}
          style={styles.fileImage}
          contentFit="cover"
          transition={200}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.fileRow}
      onPress={() => Linking.openURL(signedUrl)}
    >
      <Ionicons name="document-outline" size={22} color={iconColor} />
      <View style={{ flex: 1 }}>
        <ThemedText
          style={[styles.fileName, isOwn && { color: "#fff" }]}
          numberOfLines={2}
        >
          {fileName ?? "File"}
        </ThemedText>
      </View>
      <Ionicons name="open-outline" size={16} color={iconColor} />
    </TouchableOpacity>
  );
}

export default function RoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>("Chat");
  const flatListRef = useRef<FlatList>(null);

  // --- THEME COLORS ---
  const textColor = useThemeColor({}, "text");
  // We use a specific Gray for "Other" bubbles that works in both modes
  const otherBubbleColor = useThemeColor(
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

  // Safe Blue for "My Messages" (Ensures white text is always visible)
  const myBubbleColor = "#0a7ea4";

  const fetchRoomDetails = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("rooms")
      .select("name, invite_code")
      .eq("id", roomId)
      .single();

    if (!error && data) {
      setRoomName(data.name);
      setInviteCode(data.invite_code);
    }
  }, [roomId]);

  const shareInviteLink = useCallback(async () => {
    if (!inviteCode) {
      Alert.alert("Error", "Unable to generate invite link");
      return;
    }

    try {
      await Share.share({
        message: `Join "${roomName}" on Yolcu Chat!\n\nyolcu://join/${inviteCode}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [inviteCode, roomName]);

  const navigateToSettings = useCallback(() => {
    router.push(`/room/${roomId}/settings`);
  }, [router, roomId]);

  // Set up header with share and settings buttons
  useLayoutEffect(() => {
    navigation.setOptions({
      title: roomName,
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={shareInviteLink} style={{ padding: 8 }}>
            <Ionicons name="share-outline" size={24} color={myBubbleColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={navigateToSettings} style={{ padding: 8 }}>
            <Ionicons name="settings-outline" size={24} color={myBubbleColor} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [
    navigation,
    roomName,
    shareInviteLink,
    navigateToSettings,
    myBubbleColor,
  ]);

  const getCurrentUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*, profiles(display_name, avatar_url)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) console.error("Error fetching messages:", error);
    else setMessages(data || []);
    setLoading(false);
  }, [roomId]);

  const subscribeToMessages = useCallback(() => {
    if (!roomId) return () => {};

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as MessageWithProfile;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", newMsg.user_id)
            .single();

          setMessages((prev) => [...prev, { ...newMsg, profiles: profile }]);
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            100,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    getCurrentUser();
    fetchMessages();
    fetchRoomDetails();
    const unsubscribe = subscribeToMessages();
    return () => {
      unsubscribe();
    };
  }, [getCurrentUser, fetchMessages, fetchRoomDetails, subscribeToMessages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !userId || !roomId || sending) return;

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      content: newMessage.trim(),
      user_id: userId,
      room_id: roomId,
    });

    if (error) console.error("Error sending message:", error);
    else setNewMessage("");
    setSending(false);
  };

  const pickAndSendFile = async () => {
    if (!userId || !roomId || sending) return;

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const file = result.assets[0];
    setSending(true);

    try {
      const timestamp = Date.now();
      const storagePath = `${roomId}/${userId}/${timestamp}_${file.name}`;

      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(storagePath, arrayBuffer, {
          contentType: file.mimeType ?? "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      const { error: messageError } = await supabase.from("messages").insert({
        content: "",
        user_id: userId,
        room_id: roomId,
        file_path: storagePath,
        file_name: file.name,
        file_type: file.mimeType ?? "application/octet-stream",
        file_size: file.size ?? null,
      });

      if (messageError) throw messageError;
    } catch (err) {
      console.error("Error sending file:", err);
      Alert.alert("Error", "Failed to send file. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: MessageWithProfile }) => {
    const isOwnMessage = item.user_id === userId;

    // Get initial for avatar
    const initial = item.profiles?.display_name
      ? item.profiles.display_name.charAt(0).toUpperCase()
      : "?";

    const avatarUrl = item.profiles?.avatar_url;

    return (
      <View
        style={[
          styles.messageRow,
          isOwnMessage ? styles.rowReverse : styles.row,
        ]}
      >
        {/* Avatar Circle (Only for others) */}
        {!isOwnMessage && (
          <View style={[styles.avatar, { backgroundColor: otherBubbleColor }]}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <ThemedText style={styles.avatarText}>{initial}</ThemedText>
            )}
          </View>
        )}

        <View
          style={[
            styles.messageBubble,
            isOwnMessage
              ? [styles.ownMessage, { backgroundColor: myBubbleColor }]
              : [styles.otherMessage, { backgroundColor: otherBubbleColor }],
          ]}
        >
          {/* Display Name (only for others) */}
          {!isOwnMessage && item.profiles?.display_name && (
            <ThemedText style={styles.senderName}>
              {item.profiles.display_name}
            </ThemedText>
          )}

          {item.content.length > 0 && (
            <ThemedText
              style={[
                styles.messageText,
                // Fix: Force white text for own messages, standard theme text for others
                isOwnMessage ? { color: "#ffffff" } : { color: textColor },
              ]}
            >
              {item.content}
            </ThemedText>
          )}

          {item.file_path && (
            <FileAttachment
              filePath={item.file_path}
              fileType={item.file_type}
              fileName={item.file_name}
              isOwn={isOwnMessage}
              textColor={textColor}
            />
          )}

          <ThemedText
            style={[
              styles.timestamp,
              isOwnMessage
                ? { color: "rgba(255,255,255,0.7)" }
                : { color: placeholderColor },
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </ThemedText>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={myBubbleColor} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        <View
          style={[styles.inputContainer, { backgroundColor: "transparent" }]}
        >
          <TouchableOpacity
            style={[styles.attachButton, { backgroundColor: inputBgColor }]}
            onPress={pickAndSendFile}
            disabled={sending}
          >
            <Ionicons
              name="attach-outline"
              size={22}
              color={sending ? placeholderColor : myBubbleColor}
            />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.input,
              { color: textColor, backgroundColor: inputBgColor },
            ]}
            placeholder="Message..."
            placeholderTextColor={placeholderColor}
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: myBubbleColor },
              (!newMessage.trim() || sending) && styles.disabledButton,
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  messageList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
    gap: 12,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
    gap: 8,
  },
  row: {
    justifyContent: "flex-start",
  },
  rowReverse: {
    justifyContent: "flex-end",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "bold",
    opacity: 0.6,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 18,
  },
  ownMessage: {
    borderBottomRightRadius: 2,
  },
  otherMessage: {
    borderBottomLeftRadius: 2,
  },
  senderName: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    opacity: 0.6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  fileImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginTop: 4,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    maxWidth: 220,
  },
  fileName: {
    fontSize: 13,
    flexShrink: 1,
  },
});
