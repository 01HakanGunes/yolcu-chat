export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  device_type: "ios" | "android" | "web";
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string;
}

export interface Room {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  content: string;
  user_id: string;
  room_id: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      push_tokens: {
        Row: PushToken;
        Insert: Omit<PushToken, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<PushToken, "id" | "created_at" | "updated_at">> & {
          updated_at?: string;
        };
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "id"> & {
          id: string;
        };
        Update: Partial<Omit<Profile, "id">>;
      };
      rooms: {
        Row: Room;
        Insert: Omit<Room, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Room, "id" | "created_at">>;
      };
      room_members: {
        Row: RoomMember;
        Insert: Omit<RoomMember, "joined_at"> & {
          joined_at?: string;
        };
        Update: Partial<Omit<RoomMember, "room_id" | "user_id">>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Message, "id" | "created_at">>;
      };
    };
  };
}
