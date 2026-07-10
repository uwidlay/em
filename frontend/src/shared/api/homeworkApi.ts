import type {
  ApiResult,
  HomeworkReviewResult,
  HomeworkSubmissionResult,
  ReviewHomeworkPayload,
  SubmitHomeworkPayload,
} from './contracts'
import { assertSupabaseNotConnected } from './supabaseClient'

export async function reviewHomework(payload: ReviewHomeworkPayload): Promise<ApiResult<HomeworkReviewResult>> {
  void payload
  return assertSupabaseNotConnected('reviewHomework')
}

export async function submitHomework(payload: SubmitHomeworkPayload): Promise<ApiResult<HomeworkSubmissionResult>> {
  void payload
  return assertSupabaseNotConnected('submitHomework')
}
