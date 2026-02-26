// Live session screen — full-screen modal using LiveKit WebRTC

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  type ViewStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioSession,
  LiveKitRoom,
  useTracks,
  VideoTrack,
  isTrackReference,
  useRoomContext,
  useParticipants,
  TrackReferenceOrPlaceholder,
} from "@livekit/react-native";
import { Track } from "livekit-client";

import { ThemedText } from "@/components/themed-text";
import { supabase } from "@/lib/supabase";

const TILE_GAP = 6;

// --- PARTICIPANT TILE ---
function ParticipantTile({
  trackRef,
  name,
  tileStyle,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  name: string;
  tileStyle: ViewStyle;
}) {
  if (isTrackReference(trackRef)) {
    return (
      <View style={[styles.tile, tileStyle]}>
        <VideoTrack trackRef={trackRef} style={styles.videoTrack} />
        <View style={styles.nameTag}>
          <ThemedText style={styles.nameTagText} numberOfLines={1}>
            {name}
          </ThemedText>
        </View>
      </View>
    );
  }

  // Placeholder — participant has no video (audio only or not yet publishing)
  return (
    <View style={[styles.tile, styles.tilePlaceholder, tileStyle]}>
      <View style={styles.avatarCircle}>
        <ThemedText style={styles.avatarLetter}>
          {name.charAt(0).toUpperCase()}
        </ThemedText>
      </View>
      <View style={styles.nameTag}>
        <ThemedText style={styles.nameTagText} numberOfLines={1}>
          {name}
        </ThemedText>
      </View>
    </View>
  );
}

// --- ROOM CONTENT (rendered inside LiveKitRoom) ---
function RoomContent({
  roomId,
  isCreator,
  onLeave,
}: {
  roomId: string;
  isCreator: boolean;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [ending, setEnding] = useState(false);
  const facingModeRef = useRef<"user" | "environment">("user");

  // Auto-leave when creator ends the session (is_live goes false via Realtime)
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`live-screen-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as { is_live: boolean };
          if (!updated.is_live) {
            // Session ended by creator — disconnect and go back
            room.disconnect();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, room]);

  const toggleMic = useCallback(async () => {
    await room.localParticipant.setMicrophoneEnabled(!micEnabled);
    setMicEnabled((v) => !v);
  }, [micEnabled, room]);

  const toggleCamera = useCallback(async () => {
    await room.localParticipant.setCameraEnabled(!camEnabled);
    setCamEnabled((v) => !v);
  }, [camEnabled, room]);

  const flipCamera = useCallback(async () => {
    const publication = room.localParticipant.getTrackPublication(
      Track.Source.Camera,
    );
    if (!publication?.track) return;

    const nextFacing =
      facingModeRef.current === "user" ? "environment" : "user";
    facingModeRef.current = nextFacing;

    await publication.track.restartTrack({ facingMode: nextFacing });
  }, [room]);

  const handleLeave = useCallback(async () => {
    if (isCreator) {
      Alert.alert(
        "End Session",
        "This will end the session for everyone in the room.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "End for all",
            style: "destructive",
            onPress: async () => {
              setEnding(true);
              await supabase.rpc("set_room_live", {
                room_id: roomId,
                live: false,
              });
              room.disconnect();
              setEnding(false);
            },
          },
        ],
      );
    } else {
      room.disconnect();
    }
  }, [isCreator, roomId, room]);

  // Map participant identity → display name from participants list
  const getParticipantName = useCallback(
    (identity: string) => {
      const p = participants.find((pt) => pt.identity === identity);
      return p?.name ?? identity.slice(0, 8);
    },
    [participants],
  );

  // Compute dynamic tile sizes based on participant count.
  // The grid area is measured via onLayout; tiles fill the space evenly.
  const [gridHeight, setGridHeight] = useState(0);
  const [gridWidth, setGridWidth] = useState(0);

  const tileStyle = useMemo((): ViewStyle => {
    const count = tracks.length;
    if (count === 0 || gridWidth === 0 || gridHeight === 0) {
      return { width: "100%", height: "100%" };
    }

    // Determine grid layout: columns and rows
    let cols: number;
    let rows: number;

    if (count === 1) {
      cols = 1;
      rows = 1;
    } else if (count === 2) {
      cols = 1;
      rows = 2;
    } else if (count <= 4) {
      cols = 2;
      rows = 2;
    } else if (count <= 6) {
      cols = 2;
      rows = 3;
    } else {
      cols = 2;
      rows = Math.ceil(count / 2);
    }

    // padding: TILE_GAP/2 each side = TILE_GAP total, plus (cols-1) gaps
    const tileW = (gridWidth - TILE_GAP * cols) / cols;
    const tileH = (gridHeight - TILE_GAP * rows) / rows;

    return { width: tileW, height: tileH };
  }, [tracks.length, gridWidth, gridHeight]);

  // Whether the grid should scroll (more than 6 participants)
  const shouldScroll = tracks.length > 6;

  return (
    <SafeAreaView style={styles.roomContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <ThemedText style={styles.liveLabel}>LIVE</ThemedText>
        </View>
        <ThemedText style={styles.participantCount}>
          {participants.length} participant{participants.length !== 1 ? "s" : ""}
        </ThemedText>
      </View>

      {/* Participant grid */}
      <View
        style={styles.gridContainer}
        onLayout={(e) => {
          setGridWidth(e.nativeEvent.layout.width);
          setGridHeight(e.nativeEvent.layout.height);
        }}
      >
        {tracks.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#fff" />
            <ThemedText style={styles.emptyText}>
              Waiting for participants...
            </ThemedText>
          </View>
        ) : shouldScroll ? (
          <ScrollView contentContainerStyle={styles.grid}>
            {tracks.map((trackRef) => {
              const identity = trackRef.participant.identity;
              const name =
                trackRef.participant.name ?? getParticipantName(identity);
              return (
                <ParticipantTile
                  key={`${identity}-${trackRef.source}`}
                  trackRef={trackRef}
                  name={name}
                  tileStyle={tileStyle}
                />
              );
            })}
          </ScrollView>
        ) : (
          <View style={[styles.grid, styles.gridFill]}>
            {tracks.map((trackRef) => {
              const identity = trackRef.participant.identity;
              const name =
                trackRef.participant.name ?? getParticipantName(identity);
              return (
                <ParticipantTile
                  key={`${identity}-${trackRef.source}`}
                  trackRef={trackRef}
                  name={name}
                  tileStyle={tileStyle}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, !micEnabled && styles.controlBtnOff]}
          onPress={toggleMic}
        >
          <Ionicons
            name={micEnabled ? "mic" : "mic-off"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.endBtn]}
          onPress={handleLeave}
          disabled={ending}
        >
          {ending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="call" size={24} color="#fff" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, !camEnabled && styles.controlBtnOff]}
          onPress={toggleCamera}
        >
          <Ionicons
            name={camEnabled ? "videocam" : "videocam-off"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>

        {camEnabled && Platform.OS !== "web" && (
          <TouchableOpacity style={styles.controlBtn} onPress={flipCamera}>
            <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// --- MAIN SCREEN ---
export default function LiveScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = useRef(false);

  // Start audio session on mount, stop on unmount
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  // Fetch LiveKit token from our edge function
  useEffect(() => {
    if (!roomId) return;

    const fetchToken = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      // Check if current user is the room creator
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: room } = await supabase
        .from("rooms")
        .select("created_by")
        .eq("id", roomId)
        .single();

      setIsCreator(room?.created_by === user?.id);

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/livekit-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabaseKey,
          },
          body: JSON.stringify({ room_id: roomId }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Failed to get session token");
        return;
      }

      const { token: lkToken, url: lkUrl } = await response.json();
      setToken(lkToken);
      setServerUrl(lkUrl);
    };

    fetchToken();
  }, [roomId]);

  const handleDisconnect = useCallback(() => {
    if (connected.current) {
      connected.current = false;
      router.back();
    }
  }, [router]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="warning-outline" size={48} color="#e63946" />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ThemedText style={styles.backBtnText}>Go back</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  if (!token || !serverUrl) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
        <ThemedText style={styles.loadingText}>
          Joining live session...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.lkRoom}>
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={true}
        audio={true}
        video={true}
        onConnected={() => {
          connected.current = true;
        }}
        onDisconnected={handleDisconnect}
      >
        <RoomContent
          roomId={roomId!}
          isCreator={isCreator}
          onLeave={handleDisconnect}
        />
      </LiveKitRoom>
    </View>
  );
}

const styles = StyleSheet.create({
  lkRoom: {
    flex: 1,
    backgroundColor: "#000",
  },
  roomContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    padding: 32,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    opacity: 0.8,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    opacity: 0.9,
  },
  backBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#333",
    borderRadius: 12,
  },
  backBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e63946",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  liveLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
  participantCount: {
    color: "#aaa",
    fontSize: 13,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignContent: "center",
    padding: TILE_GAP / 2,
    gap: TILE_GAP,
  },
  gridFill: {
    flex: 1,
  },
  gridContainer: {
    flex: 1,
  },
  tile: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  tilePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  videoTrack: {
    flex: 1,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0a7ea4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarLetter: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  nameTag: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nameTagText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emptyText: {
    color: "#aaa",
    fontSize: 15,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  controlBtnOff: {
    backgroundColor: "#555",
    opacity: 0.7,
  },
  endBtn: {
    backgroundColor: "#e63946",
    transform: [{ rotate: "135deg" }],
  },
});
