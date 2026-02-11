import { useState } from "react";
import { TextInput, Button, StyleSheet, Alert } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({ light: "#ccc", dark: "#555" }, "text");
  const placeholderColor = useThemeColor(
    { light: "#999", dark: "#666" },
    "icon",
  );

  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", "Check your email for confirmation link!");
    }
    setLoading(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Sign Up
      </ThemedText>

      <TextInput
        style={[styles.input, { color: textColor, borderColor }]}
        placeholder="Email"
        placeholderTextColor={placeholderColor}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={[styles.input, { color: textColor, borderColor }]}
        placeholder="Password"
        placeholderTextColor={placeholderColor}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button
        title={loading ? "Loading..." : "Sign Up"}
        onPress={handleSignUp}
        disabled={loading}
      />

      <Link href="/(auth)/sign-in" style={styles.link}>
        <ThemedText>Already have an account? Sign In</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  link: {
    marginTop: 15,
    textAlign: "center",
  },
});
