export type Phase = 'lobby' | 'playing' | 'validating' | 'results';

export interface ProfileRow {
  id: string;
  display_name: string;
  created_at: string;
}

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  phase: Phase;
  timer_seconds: number;
  sentence: string | null;
  letters_26: string | null;
  created_at: string;
}

export interface RoomPlayerRow {
  id: string;
  room_id: string;
  player_id: string;
  joined_at: string;
}

export interface SubmissionRow {
  id: string;
  room_id: string;
  player_id: string;
  row_index: number;
  initials: string;
  name: string;
  created_at: string;
}

export interface VoteRow {
  id: string;
  room_id: string;
  submission_id: string;
  voter_id: string;
  is_valid: boolean;
  created_at: string;
}

export interface ScoreRow {
  id: string;
  room_id: string;
  player_id: string;
  total: number;
  breakdown: Record<string, number>;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow> };
      rooms: { Row: RoomRow; Insert: Partial<RoomRow>; Update: Partial<RoomRow> };
      room_players: {
        Row: RoomPlayerRow;
        Insert: Partial<RoomPlayerRow>;
        Update: Partial<RoomPlayerRow>;
      };
      submissions: {
        Row: SubmissionRow;
        Insert: Partial<SubmissionRow>;
        Update: Partial<SubmissionRow>;
      };
      votes: { Row: VoteRow; Insert: Partial<VoteRow>; Update: Partial<VoteRow> };
      scores: { Row: ScoreRow; Insert: Partial<ScoreRow>; Update: Partial<ScoreRow> };
    };
    Functions: {
      compute_room_scores: {
        Args: { p_room_id: string };
        Returns: void;
      };
    };
  };
}
