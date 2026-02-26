import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

// 1. Updated Chunking Adapter to handle the 2048-byte limit
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunk_count`);
    if (!chunkCount) {
      return SecureStore.getItemAsync(key);
    }

    let fullValue = "";
    for (let i = 0; i < parseInt(chunkCount); i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      fullValue += chunk || "";
    }
    return fullValue;
  },

  setItem: async (key: string, value: string) => {
    const MAX_CHUNK_SIZE = 2000;

    // Clear any existing data first
    await ExpoSecureStoreAdapter.removeItem(key);

    if (value.length <= MAX_CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
    } else {
      const chunks = Math.ceil(value.length / MAX_CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}_chunk_count`, chunks.toString());

      for (let i = 0; i < chunks; i++) {
        const chunk = value.substring(
          i * MAX_CHUNK_SIZE,
          (i + 1) * MAX_CHUNK_SIZE,
        );
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
      }
    }
  },

  removeItem: async (key: string) => {
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunk_count`);
    if (chunkCount) {
      for (let i = 0; i < parseInt(chunkCount); i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}_chunk_count`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const WebStorageAdapter = {
  getItem: async (key: string) => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: async (key: string, value: string) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// 2. The Exported Client
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: Platform.OS === "web" ? WebStorageAdapter : ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
