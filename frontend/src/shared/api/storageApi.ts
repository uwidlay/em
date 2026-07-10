import type { ApiResult, CompletedHomeworkPhoto, PreparedHomeworkUpload } from './contracts'
import { assertSupabaseNotConnected } from './supabaseClient'

export type UploadHomeworkPhotoPayload = {
  target: PreparedHomeworkUpload
  file: File
}

export async function uploadHomeworkPhoto(payload: UploadHomeworkPhotoPayload): Promise<ApiResult<CompletedHomeworkPhoto>> {
  void payload
  return assertSupabaseNotConnected('uploadHomeworkPhoto')
}

export async function getHomeworkPhotoPreviewUrl(storagePath: string): Promise<ApiResult<string>> {
  void storagePath
  return assertSupabaseNotConnected('getHomeworkPhotoPreviewUrl')
}
