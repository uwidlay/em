import { createClient } from '@supabase/supabase-js'
import { readSupabaseConfig, supabaseMissingEnvMessage } from '../config/supabaseConfig'

export type TutorSpaceDatabase = {
  public: {
    Tables: {
      homework_submission_photos: {
        Row: {
          id: string
          submission_id: string
          storage_path: string
          original_filename: string | null
          mime_type: string
          size_bytes: number
          width: number | null
          height: number | null
          sort_order: number
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      homework_submissions: {
        Row: {
          id: string
          lesson_id: string
          student_id: string
          comment: string | null
          submitted_at: string
          is_revision: boolean
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      lesson_materials: {
        Row: {
          id: string
          lesson_id: string
          title: string
          url: string
          material_type: 'note' | 'video' | 'presentation' | 'board' | 'taskbook' | 'other'
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          title: string
          url: string
          material_type?: 'note' | 'video' | 'presentation' | 'board' | 'taskbook' | 'other'
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          title?: string
          url?: string
          material_type?: 'note' | 'video' | 'presentation' | 'board' | 'taskbook' | 'other'
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          id: string
          student_id: string
          lesson_date: string
          topic: string
          comprehension_rating: number | null
          homework_text: string | null
          homework_deadline: string | null
          homework_status: 'not_submitted' | 'in_review' | 'checked' | 'needs_correction'
          homework_review_comment: string | null
          homework_first_submitted_at: string | null
          homework_late_days: number | null
          is_paid: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          lesson_date: string
          topic: string
          comprehension_rating?: number | null
          homework_text?: string | null
          homework_deadline?: string | null
          homework_status?: 'not_submitted' | 'in_review' | 'checked' | 'needs_correction'
          homework_review_comment?: string | null
          homework_first_submitted_at?: string | null
          homework_late_days?: number | null
          is_paid?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          lesson_date?: string
          topic?: string
          comprehension_rating?: number | null
          homework_text?: string | null
          homework_deadline?: string | null
          homework_status?: 'not_submitted' | 'in_review' | 'checked' | 'needs_correction'
          homework_review_comment?: string | null
          homework_first_submitted_at?: string | null
          homework_late_days?: number | null
          is_paid?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          id: string
          tutor_id: string
          name: string
          subject: string
          grade: string | null
          student_contact: string | null
          parent_contact: string | null
          lesson_price: number | string | null
          lesson_duration_minutes: number | null
          comment: string | null
          status: 'active' | 'archived'
          access_token_hash: string
          access_token_created_at: string
          schedule_text: string | null
          goals_text: string | null
          meeting_url: string | null
          has_unread_updates_for_student: boolean
          created_at: string
          updated_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          tutor_id: string
          name: string
          subject: string
          grade?: string | null
          student_contact?: string | null
          parent_contact?: string | null
          lesson_price?: number | null
          lesson_duration_minutes?: number | null
          comment?: string | null
          status?: 'active' | 'archived'
          access_token_hash: string
          access_token_created_at?: string
          schedule_text?: string | null
          goals_text?: string | null
          meeting_url?: string | null
          has_unread_updates_for_student?: boolean
          created_at?: string
          updated_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          tutor_id?: string
          name?: string
          subject?: string
          grade?: string | null
          student_contact?: string | null
          parent_contact?: string | null
          lesson_price?: number | null
          lesson_duration_minutes?: number | null
          comment?: string | null
          status?: 'active' | 'archived'
          access_token_hash?: string
          access_token_created_at?: string
          schedule_text?: string | null
          goals_text?: string | null
          meeting_url?: string | null
          has_unread_updates_for_student?: boolean
          created_at?: string
          updated_at?: string
          archived_at?: string | null
        }
        Relationships: []
      }
      tutors: {
        Row: {
          id: string
          auth_user_id: string
          name: string
          email: string
          phone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          name: string
          email: string
          phone: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string
          name?: string
          email?: string
          phone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      update_events: {
        Row: {
          id: string
          student_id: string
          lesson_id: string | null
          event_type: 'lesson_created' | 'homework_changed' | 'review_comment_added' | 'homework_status_changed' | 'material_added'
          is_seen_by_student: boolean
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          lesson_id?: string | null
          event_type: 'lesson_created' | 'homework_changed' | 'review_comment_added' | 'homework_status_changed' | 'material_added'
          is_seen_by_student?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          lesson_id?: string | null
          event_type?: 'lesson_created' | 'homework_changed' | 'review_comment_added' | 'homework_status_changed' | 'material_added'
          is_seen_by_student?: boolean
          created_at?: string
        }
        Relationships: []
      }
      useful_links: {
        Row: {
          id: string
          student_id: string
          title: string
          url: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          title: string
          url: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          title?: string
          url?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type TutorSpaceSupabaseClient = ReturnType<typeof createClient<TutorSpaceDatabase>>

let client: TutorSpaceSupabaseClient | null = null
let didWarnAboutMissingEnv = false

export function getSupabaseClient(): TutorSpaceSupabaseClient | null {
  const config = readSupabaseConfig()

  if (!config) {
    if (import.meta.env.DEV && !didWarnAboutMissingEnv) {
      console.warn(supabaseMissingEnvMessage)
      didWarnAboutMissingEnv = true
    }
    return null
  }

  client ??= createClient<TutorSpaceDatabase>(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'tutor-space-auth',
    },
  })

  return client
}

export function assertSupabaseNotConnected(moduleName: string): never {
  throw new Error(`${moduleName}: Supabase API methods are declared but not wired to real requests yet.`)
}
