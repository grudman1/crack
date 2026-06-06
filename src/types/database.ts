import type { TraceRecord } from '@/services/wikiValidationService';

export type Phase = 'lobby' | 'playing' | 'validating' | 'results';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'duplicate';
export type ResolutionType =
  | 'fix_validator'
  | 'add_to_dataset'
  | 'remove_from_dataset'
  | null;

export interface ProfileRow {
  id: string;
  display_name: string;
  is_admin: boolean;
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
  play_started_at: string | null;
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

export interface ValidationReviewRow {
  id: string;
  name: string;
  expected_pair: string;
  actual_result: 'valid' | 'invalid';
  reason: string | null;
  trace: TraceRecord[];
  player_id: string | null;
  user_comment: string | null;
  status: ReviewStatus;
  resolution_type: ResolutionType;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  client_fingerprint: string | null;
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
      validation_reviews: {
        Row: ValidationReviewRow;
        Insert: Partial<ValidationReviewRow>;
        Update: Partial<ValidationReviewRow>;
      };
    };
    Functions: {
      compute_room_scores: {
        Args: { p_room_id: string };
        Returns: void;
      };
    };
  };
}
