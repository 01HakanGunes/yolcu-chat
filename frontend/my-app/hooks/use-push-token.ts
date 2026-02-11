import { useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";
import type { PushToken } from "@/lib/types/database";

interface PushTokenState {
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UsePushTokenReturn extends PushTokenState {
  registerPushToken: () => Promise<string | null>;
  removePushToken: () => Promise<void>;
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushToken(): UsePushTokenReturn {
  const [state, setState] = useState<PushTokenState>({
    token: null,
    isLoading: false,
    error: null,
  });

  const registerPushToken = useCallback(async (): Promise<string | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Must be a physical device
      if (!Device.isDevice) {
        console.warn("Push notifications require a physical device");
        setState({ token: null, isLoading: false, error: null });
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        throw new Error("Permission not granted for push notifications");
      }

      // Android requires a notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      // Get the Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        throw new Error("EAS Project ID not found in app config");
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const token = tokenData.data;

      // Save to Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const deviceType: PushToken["device_type"] =
        Platform.OS === "ios"
          ? "ios"
          : Platform.OS === "android"
            ? "android"
            : "web";

      // Upsert: Insert or update if token already exists for this user
      const { error } = await supabase.from("push_tokens").upsert(
        {
          user_id: user.id,
          token,
          device_type: deviceType,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,token",
        },
      );

      if (error) {
        throw new Error(`Failed to save push token: ${error.message}`);
      }

      setState({ token, isLoading: false, error: null });
      return token;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setState({ token: null, isLoading: false, error: errorMessage });
      console.error("Push token registration error:", error);
      return null;
    }
  }, []);

  const removePushToken = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      if (state.token) {
        const { error } = await supabase
          .from("push_tokens")
          .delete()
          .eq("user_id", user.id)
          .eq("token", state.token);

        if (error) {
          throw new Error(`Failed to remove push token: ${error.message}`);
        }
      }

      setState({ token: null, isLoading: false, error: null });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      console.error("Push token removal error:", error);
    }
  }, [state.token]);

  return {
    ...state,
    registerPushToken,
    removePushToken,
  };
}
