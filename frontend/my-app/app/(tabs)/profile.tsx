import { useEffect, useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  View,
  ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";
import { useThemeColor } from "@/hooks/use-theme-color";
import { router } from "expo-router";

export default function ProfileScreen() {
  const [displayName, setDisplayName] = useState<string>("");
  const [editedName, setEditedName] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Theme Colors
  const textColor = useThemeColor({}, "text");
  const iconColor = useThemeColor(
    { light: "#687076", dark: "#9BA1A6" },
    "icon",
  );
  const backgroundColor = useThemeColor(
    { light: "#f2f2f7", dark: "#000" },
    "background",
  );
  const cardColor = useThemeColor(
    { light: "#fff", dark: "#151718" },
    "background",
  );
  const borderColor = useThemeColor({ light: "#ccc", dark: "#333" }, "text");

  // Safe primary color that ensures white text is always readable
  const primaryButtonColor = "#0a7ea4";

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/(auth)/sign-in");
        return;
      }
      setUserId(user.id);
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
      } else {
        const name = data?.display_name || "";
        setDisplayName(name);
        setEditedName(name);
        if (data?.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId || !editedName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: editedName.trim() })
      .eq("id", userId);

    if (error) {
      Alert.alert("Error", "Failed to update display name");
    } else {
      setDisplayName(editedName.trim());
      setIsEditing(false);
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant access to your photo library to upload a profile picture.",
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!userId) return;

    setUploadingAvatar(true);
    try {
      // Fetch the image as a blob first to check size and type
      const response = await fetch(uri);
      const blob = await response.blob();

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(blob.type)) {
        Alert.alert(
          "Invalid File Type",
          "Please select a JPEG, PNG, or WebP image.",
        );
        return;
      }

      // Validate file size (2MB = 2 * 1024 * 1024 bytes)
      const maxSize = 2 * 1024 * 1024;
      if (blob.size > maxSize) {
        Alert.alert(
          "File Too Large",
          `Image size must be under 2MB. Your image is ${(blob.size / (1024 * 1024)).toFixed(1)}MB.`,
        );
        return;
      }

      // Get file extension from blob type (more reliable than URI)
      const fileExt = blob.type.split("/")[1] || "jpg";
      const fileName = `${userId}/avatar.${fileExt}`;

      // Convert blob to ArrayBuffer for Supabase upload
      const arrayBuffer = await new Response(blob).arrayBuffer();

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("profile-pics")
        .upload(fileName, arrayBuffer, {
          contentType: blob.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        Alert.alert("Error", "Failed to upload image. Please try again.");
        return;
      }

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-pics").getPublicUrl(fileName);

      // Update the profile with the new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) {
        console.error("Profile update error:", updateError);
        Alert.alert("Error", "Failed to save avatar. Please try again.");
        return;
      }

      // Add cache-busting query param to force image refresh
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={primaryButtonColor} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header / Avatar Section */}
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={pickImage}
              disabled={uploadingAvatar}
              style={[styles.avatarContainer, { borderColor: borderColor }]}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="large" color={primaryButtonColor} />
              ) : avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <Ionicons name="person" size={40} color={iconColor} />
              )}
              <View
                style={[
                  styles.editBadge,
                  { backgroundColor: primaryButtonColor },
                ]}
              >
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            {!isEditing && (
              <ThemedText type="subtitle" style={styles.headerName}>
                {displayName || "User"}
              </ThemedText>
            )}
          </View>

          {/* Form Section */}
          <View style={[styles.card, { backgroundColor: cardColor }]}>
            <ThemedText style={styles.label}>Display Name</ThemedText>

            {isEditing ? (
              <View>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: textColor,
                      borderColor: borderColor,
                      borderBottomColor: primaryButtonColor,
                    },
                  ]}
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Enter your name"
                  placeholderTextColor={iconColor}
                  autoFocus
                />

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.smallButton, { borderColor }]}
                    onPress={() => {
                      setEditedName(displayName);
                      setIsEditing(false);
                    }}
                    disabled={saving}
                  >
                    <ThemedText>Cancel</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.smallButton,
                      {
                        backgroundColor: primaryButtonColor,
                        borderColor: primaryButtonColor,
                      },
                    ]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <ThemedText style={{ color: "#fff" }}>Save</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.readOnlyRow}>
                <ThemedText style={styles.displayValue}>
                  {displayName || "No name set"}
                </ThemedText>
                <TouchableOpacity onPress={() => setIsEditing(true)}>
                  <Ionicons
                    name="pencil-sharp"
                    size={20}
                    color={primaryButtonColor}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#dc3545"
              style={{ marginRight: 8 }}
            />
            <ThemedText style={styles.logoutText}>Log Out</ThemedText>
          </TouchableOpacity>
        </ScrollView>
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
  scrollContent: {
    padding: 24,
    paddingTop: 60, // Better spacing for status bar
  },
  // Avatar & Header
  headerContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    // Add simple shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerName: {
    fontSize: 24,
    fontWeight: "bold",
  },
  // Card Styling
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    // Shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  // Input Styling
  input: {
    fontSize: 18,
    paddingVertical: 12,
    borderBottomWidth: 2,
    marginBottom: 20,
  },
  displayValue: {
    fontSize: 18,
    fontWeight: "500",
  },
  readOnlyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  // Action Buttons
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  smallButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 80,
    alignItems: "center",
  },
  // Logout Styling
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(220, 53, 69, 0.1)", // Light red background
    marginTop: "auto",
  },
  logoutText: {
    color: "#dc3545",
    fontWeight: "600",
    fontSize: 16,
  },
});
