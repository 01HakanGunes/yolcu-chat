# AGENTS.md - Yolcu Chat Development Guide

## Project Overview

Yolcu Chat is a React Native mobile chat app built with Expo and Supabase.

- **Frontend**: `frontend/my-app/` - Expo app with React Native
- **Backend**: `backend/` - Supabase Edge Functions and database

## Build Commands

### Frontend (Expo)

```bash
cd frontend/my-app
npm run start       # Start Expo dev server
npm run web         # Run on web
npm run android     # Run on Android
npm run ios         # Run on iOS
npm run lint        # Run ESLint
```

### Backend

```bash
cd backend
supabase functions deploy send-push
supabase start
```

### Running Tests

No test suite currently configured. To add: install `jest` and `@testing-library/react-native`.

```bash
npm test
npm test -- --testPathPattern="RoomScreen"  # Single test file
```

## Code Style Guidelines

### TypeScript

- Use `strict: true` in `tsconfig.json`
- Use explicit types for params and returns
- Use `interface` for extensible objects, `type` for shapes/unions/primitives
- Avoid `any` - use `unknown` when unknown
- Use `null` for optional database values (not `undefined`)

```typescript
interface Message { id: string; content: string; user_id: string; }
```

### Naming Conventions

- **Components/Hooks/Types**: PascalCase (`RoomScreen`, `usePushToken`, `MessageWithProfile`)
- **Variables/Functions**: camelCase (`fetchMessages`, `roomId`)
- **Files**: kebab-case for utils, PascalCase for components (`supabase.ts`, `RoomScreen.tsx`)

### Imports

Use `@/` path alias for absolute imports. ESLint enforces this order:

1. React/React Native
2. Expo packages
3. Third-party libraries
4. Internal `@/` imports
5. Relative imports

```typescript
import { useEffect, useState } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { supabase } from "@/lib/supabase";
import type { Message } from "./types";
```

### Component Structure

Order: Types → Helper components → Main component → State → Hooks → Effects → Handlers → Render → Styles

```typescript
type Props = { roomId: string; };

function FileAttachment({ filePath }: { filePath: string }) { /* ... */ }

export default function RoomScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const fetchMessages = useCallback(async () => { /* ... */ }, [roomId]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  const sendMessage = async () => { /* ... */ };
  return <View>{/* ... */}</View>;
}

const styles = StyleSheet.create({ container: { flex: 1 } });
```

### Error Handling

- Use try/catch for async operations
- Show user-friendly errors with `Alert.alert()`
- Log errors with `console.error()`
- Return early on error conditions

```typescript
try {
  const { data, error } = await supabase.from("messages").select("*");
  if (error) { console.error("Error:", error); return; }
  setMessages(data || []);
} catch (err) {
  console.error("Unexpected:", err);
  Alert.alert("Error", "Failed to load messages");
}
```

### Supabase Patterns

- Non-null assertion for env vars: `const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;`
- Always handle errors from Supabase responses
- Use `.single()` for expected single-row results

### UI/Theming

- Use `ThemedView` and `ThemedText` for consistent theming
- Use `useThemeColor` hook for dynamic colors
- Use `StyleSheet.create` (not inline objects)

### React Native Specific

- Use `Platform.OS` for platform-specific code
- Use `KeyboardAvoidingView` from `react-native-keyboard-controller`
- Use `FlatList` for lists (not `map`)
- Use `useCallback` for functions passed to children

## Key Dependencies

- Expo SDK 54, React Native 0.81, Supabase, React Navigation 7, expo-router 6, TypeScript 5.9

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

For push notifications, configure EAS in `app.json`:

```json
{ "extra": { "eas": { "projectId": "your-project-id" } } }
```
