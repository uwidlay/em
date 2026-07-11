import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PHOTO_BUCKET = "homework-photos";
const LESSON_FILE_BUCKET = "lesson-files";
const LESSON_FILE_URL_PREFIX = "lesson-file://";
const MAX_PHOTOS_PER_SUBMISSION = 10;
const MAX_ORIGINAL_PHOTO_BYTES = 10 * 1024 * 1024;

type Action =
  | "getProfile"
  | "prepareLessonFileUploads"
  | "prepareHomeworkPhotoUploads"
  | "completeHomeworkSubmission"
  | "markUpdatesSeen";

type RequestBody = {
  action: Action;
  token?: string;
  lessonId?: string;
  comment?: string;
  photos?: PhotoInput[];
  files?: LessonFileInput[];
};

type PhotoInput = {
  storagePath?: string;
  originalFilename?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
};

type LessonFileInput = {
  originalFilename: string;
  mimeType?: string;
  sizeBytes: number;
};

type StudentRecord = {
  id: string;
  tutor_id: string;
  name: string;
  subject: string;
  grade: string | null;
  schedule_text: string | null;
  goals_text: string | null;
  meeting_url: string | null;
  has_unread_updates_for_student: boolean;
};

type LessonRecord = {
  id: string;
  student_id: string;
  homework_deadline: string | null;
  homework_first_submitted_at: string | null;
  homework_late_days: number | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  parseSecretKeys(Deno.env.get("SUPABASE_SECRET_KEYS"))?.default;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or service role secret for student-token-flow.");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as RequestBody;
    switch (body.action) {
      case "getProfile": {
        const student = await requireStudentByToken(body.token);
        return json(await getProfile(student));
      }
      case "prepareLessonFileUploads":
        return json(await prepareLessonFileUploads(req, body));
      case "prepareHomeworkPhotoUploads": {
        const student = await requireStudentByToken(body.token);
        return json(await prepareHomeworkPhotoUploads(student, body));
      }
      case "completeHomeworkSubmission": {
        const student = await requireStudentByToken(body.token);
        return json(await completeHomeworkSubmission(student, body));
      }
      case "markUpdatesSeen": {
        const student = await requireStudentByToken(body.token);
        return json(await markUpdatesSeen(student));
      }
      default:
        return json({ error: "Unsupported action" }, 400);
    }
  } catch (error) {
    const message = errorMessage(error);
    console.error("student-token-flow error", error);
    return json({ error: message }, 400);
  }
});

function parseSecretKeys(raw: string | undefined): Record<string, string> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      status?: unknown;
    };

    const parts = [maybeError.message, maybeError.details, maybeError.hint]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);

    if (parts.length > 0) return parts.join(" ");

    const meta = [maybeError.code, maybeError.status].filter(Boolean).join(", ");
    if (meta) return `Supabase error: ${meta}`;
  }

  return "Unexpected error";
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function validateBaseRequest(body: RequestBody): void {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  if (!body.action) {
    throw new Error("Action is required.");
  }
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function findStudentByToken(token: string): Promise<StudentRecord | null> {
  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabaseAdmin
    .from("students")
    .select(
      "id,tutor_id,name,subject,grade,schedule_text,goals_text,meeting_url,has_unread_updates_for_student",
    )
    .eq("access_token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data as StudentRecord | null;
}

async function requireStudentByToken(token: string | undefined): Promise<StudentRecord> {
  if (!token || typeof token !== "string") {
    throw new Error("Student token is required.");
  }

  const student = await findStudentByToken(token);
  if (!student) {
    throw new Error("Invalid or expired student link");
  }

  return student;
}

async function getProfile(student: StudentRecord) {
  const [
    { data: usefulLinks, error: usefulLinksError },
    { data: lessons, error: lessonsError },
    { data: updateEvents, error: updateEventsError },
  ] =
    await Promise.all([
      supabaseAdmin
        .from("useful_links")
        .select("id,title,url,sort_order")
        .eq("student_id", student.id)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("lessons")
        .select(
          `
          id,
          created_at,
          lesson_date,
          topic,
          comprehension_rating,
          homework_text,
          homework_deadline,
          homework_status,
          homework_review_comment,
          homework_first_submitted_at,
          homework_late_days,
          is_paid,
          lesson_materials(id,title,url,material_type,sort_order),
          homework_submissions!homework_submissions_lesson_id_fkey(
            id,
            comment,
            submitted_at,
            is_revision,
            homework_submission_photos(id,storage_path,original_filename,mime_type,size_bytes,width,height,sort_order)
          )
        `,
        )
        .eq("student_id", student.id)
        .is("deleted_at", null)
        .order("lesson_date", { ascending: false }),
      supabaseAdmin
        .from("update_events")
        .select("id,event_type,created_at,is_seen_by_student,lessons!update_events_lesson_id_fkey(topic)")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (usefulLinksError) throw usefulLinksError;
  if (lessonsError) throw lessonsError;
  if (updateEventsError) throw updateEventsError;

  const profileLessons = (lessons ?? []) as Array<Record<string, unknown>>;
  await attachSignedLessonFileUrls(profileLessons);
  await attachSignedHomeworkPhotoUrls(profileLessons);

  return {
    student,
    usefulLinks: usefulLinks ?? [],
    lessons: profileLessons,
    updateEvents: updateEvents ?? [],
  };
}

async function attachSignedLessonFileUrls(lessons: Array<Record<string, unknown>>) {
  await Promise.all(
    lessons.flatMap((lesson) => {
      const materials = Array.isArray(lesson.lesson_materials) ? lesson.lesson_materials : [];

      return materials.map(async (rawMaterial) => {
        const material = rawMaterial as { url?: string | null; signed_url?: string };
        const storagePath = lessonFileStoragePathFromUrl(material.url);
        if (!storagePath) return;

        const { data, error } = await supabaseAdmin.storage
          .from(LESSON_FILE_BUCKET)
          .createSignedUrl(storagePath, 60 * 10);

        if (!error && data?.signedUrl) {
          material.signed_url = data.signedUrl;
        }
      });
    }),
  );

  return lessons;
}

async function attachSignedHomeworkPhotoUrls(lessons: Array<Record<string, unknown>>) {
  await Promise.all(
    lessons.flatMap((lesson) => {
      const submissions = Array.isArray(lesson.homework_submissions) ? lesson.homework_submissions : [];

      return submissions.flatMap((rawSubmission) => {
        const submission = rawSubmission as { homework_submission_photos?: unknown[] };
        const photos = Array.isArray(submission.homework_submission_photos)
          ? submission.homework_submission_photos
          : [];

        return photos.map(async (rawPhoto) => {
          const photo = rawPhoto as { storage_path?: string | null; signed_url?: string };
          if (!photo.storage_path) return;

          const { data, error } = await supabaseAdmin.storage
            .from(PHOTO_BUCKET)
            .createSignedUrl(photo.storage_path, 60 * 10);

          if (!error && data?.signedUrl) {
            photo.signed_url = data.signedUrl;
          }
        });
      });
    }),
  );

  return lessons;
}

function lessonFileStoragePathFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith(LESSON_FILE_URL_PREFIX)) return null;
  return url.slice(LESSON_FILE_URL_PREFIX.length);
}

async function prepareLessonFileUploads(req: Request, body: RequestBody) {
  if (!body.lessonId) throw new Error("lessonId is required.");
  const tutor = await getTutorFromRequest(req);
  const lesson = await findTutorLesson(tutor.id, body.lessonId);
  if (!lesson) throw new Error("Lesson not found for this tutor.");

  const files = validateLessonFiles(body.files);

  const uploadTargets = await Promise.all(
    files.map(async (file, index) => {
      const fileId = crypto.randomUUID();
      const storagePath = [
        `tutor_${tutor.id}`,
        `student_${lesson.student_id}`,
        `lesson_${lesson.id}`,
        `${fileId}.${lessonFileExtension(file)}`,
      ].join("/");

      const { data, error } = await supabaseAdmin.storage
        .from(LESSON_FILE_BUCKET)
        .createSignedUploadUrl(storagePath);

      if (error) throw error;

      return {
        clientFileIndex: index,
        storagePath,
        token: data.token,
        signedUrl: data.signedUrl,
      };
    }),
  );

  return {
    lessonId: lesson.id,
    uploadTargets,
  };
}

async function getTutorFromRequest(req: Request): Promise<{ id: string; auth_user_id: string }> {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new Error("Tutor auth token is required.");

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError) throw userError;
  const user = userData.user;
  if (!user) throw new Error("Tutor auth session not found.");

  const { data, error } = await supabaseAdmin
    .from("tutors")
    .select("id,auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Tutor profile not found.");

  return data as { id: string; auth_user_id: string };
}

async function findTutorLesson(tutorId: string, lessonId: string): Promise<{ id: string; student_id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("lessons")
    .select("id,student_id,students!inner(tutor_id)")
    .eq("id", lessonId)
    .eq("students.tutor_id", tutorId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return data as { id: string; student_id: string };
}

function validateLessonFiles(files: LessonFileInput[] | undefined): LessonFileInput[] {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new Error("At least one lesson file is required.");
  }

  if (files.length > 10) {
    throw new Error("No more than 10 lesson files are allowed.");
  }

  for (const file of files) {
    if (!file.originalFilename?.trim()) throw new Error("File name is required.");
    if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0) {
      throw new Error("File sizeBytes must be positive.");
    }
    if (file.sizeBytes > 25 * 1024 * 1024) {
      throw new Error("Lesson file exceeds the 25 MB size limit.");
    }
  }

  return files;
}

function lessonFileExtension(file: LessonFileInput): string {
  const mimeType = (file.mimeType || "").toLowerCase();
  const extensionByMimeType: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "text/plain": "txt",
  };

  if (extensionByMimeType[mimeType]) return extensionByMimeType[mimeType];

  const rawExtension = file.originalFilename.split(".").pop()?.toLowerCase() || "";
  const safeExtension = rawExtension.replace(/[^a-z0-9]/g, "").slice(0, 8);

  return safeExtension || "bin";
}

async function prepareHomeworkPhotoUploads(student: StudentRecord, body: RequestBody) {
  if (!body.lessonId) throw new Error("lessonId is required.");
  const photos = validatePhotos(body.photos);

  const lesson = await findStudentLesson(student.id, body.lessonId);
  if (!lesson) throw new Error("Lesson not found for this student.");

  const uploadTargets = await Promise.all(
    photos.map(async (photo, index) => {
      const ext = extensionForMimeType(photo.mimeType);
      const photoId = crypto.randomUUID();
      const storagePath = buildPhotoStoragePath({
        tutorId: student.tutor_id,
        studentId: student.id,
        lessonId: body.lessonId!,
        submissionId: "pending",
        photoId,
        ext,
      });

      const { data, error } = await supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .createSignedUploadUrl(storagePath);

      if (error) throw error;

      return {
        clientPhotoIndex: index,
        storagePath,
        token: data.token,
        signedUrl: data.signedUrl,
      };
    }),
  );

  return {
    lessonId: lesson.id,
    uploadTargets,
  };
}

async function completeHomeworkSubmission(student: StudentRecord, body: RequestBody) {
  if (!body.lessonId) throw new Error("lessonId is required.");
  const photos = validatePhotos(body.photos);

  const lesson = await findStudentLesson(student.id, body.lessonId);
  if (!lesson) throw new Error("Lesson not found for this student.");

  for (const photo of photos) {
    if (!photo.storagePath) throw new Error("storagePath is required for completed photos.");
    assertStoragePathAllowed(photo.storagePath, student.tutor_id, student.id, body.lessonId);
  }

  const firstSubmittedAt = lesson.homework_first_submitted_at
    ? new Date(lesson.homework_first_submitted_at)
    : new Date();
  const isRevision = Boolean(lesson.homework_first_submitted_at);
  const lateDays = calculateLateDays(lesson.homework_deadline, firstSubmittedAt);

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from("homework_submissions")
    .insert({
      lesson_id: body.lessonId,
      student_id: student.id,
      comment: body.comment ?? null,
      is_revision: isRevision,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (submissionError) throw submissionError;

  const targetSubmissionId = submission.id as string;
  const photoRows = photos.map((photo, index) => {
    return {
      submission_id: targetSubmissionId,
      storage_path: photo.storagePath!,
      original_filename: photo.originalFilename ?? null,
      mime_type: photo.mimeType,
      size_bytes: photo.sizeBytes,
      width: photo.width ?? null,
      height: photo.height ?? null,
      sort_order: index,
    };
  });

  // The client receives upload URLs before the submission exists, so paths include submission_pending.
  // They are still server-generated and globally unique by photo id. If final submission-specific
  // paths are required later, add a trusted Storage move step here.
  const { error: photosError } = await supabaseAdmin.from("homework_submission_photos").insert(photoRows);
  if (photosError) throw photosError;

  const lessonPatch: Record<string, unknown> = {
    homework_status: "in_review",
  };

  if (!lesson.homework_first_submitted_at) {
    lessonPatch.homework_first_submitted_at = firstSubmittedAt.toISOString();
    lessonPatch.homework_late_days = lateDays;
  }

  const { error: lessonError } = await supabaseAdmin
    .from("lessons")
    .update(lessonPatch)
    .eq("id", body.lessonId)
    .eq("student_id", student.id);

  if (lessonError) throw lessonError;

  await supabaseAdmin
    .from("students")
    .update({ has_unread_updates_for_student: false })
    .eq("id", student.id);

  return {
    submissionId: targetSubmissionId,
    status: "in_review",
    lateDays: lesson.homework_first_submitted_at ? lesson.homework_late_days : lateDays,
  };
}

async function markUpdatesSeen(student: StudentRecord) {
  const [{ error: studentError }, { error: eventsError }] = await Promise.all([
    supabaseAdmin
      .from("students")
      .update({ has_unread_updates_for_student: false })
      .eq("id", student.id),
    supabaseAdmin
      .from("update_events")
      .update({ is_seen_by_student: true })
      .eq("student_id", student.id)
      .eq("is_seen_by_student", false),
  ]);

  if (studentError) throw studentError;
  if (eventsError) throw eventsError;

  return { ok: true };
}

async function findStudentLesson(studentId: string, lessonId: string): Promise<LessonRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("lessons")
    .select("id,student_id,homework_deadline,homework_first_submitted_at,homework_late_days")
    .eq("id", lessonId)
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return data as LessonRecord | null;
}

function validatePhotos(photos: PhotoInput[] | undefined): PhotoInput[] {
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    throw new Error("At least one photo is required.");
  }

  if (photos.length > MAX_PHOTOS_PER_SUBMISSION) {
    throw new Error(`No more than ${MAX_PHOTOS_PER_SUBMISSION} photos are allowed.`);
  }

  for (const photo of photos) {
    if (!photo.mimeType) throw new Error("Photo mimeType is required.");
    if (!["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"].includes(photo.mimeType)) {
      throw new Error("Unsupported photo format.");
    }
    if (!Number.isFinite(photo.sizeBytes) || photo.sizeBytes <= 0) {
      throw new Error("Photo sizeBytes must be positive.");
    }
    if (photo.sizeBytes > MAX_ORIGINAL_PHOTO_BYTES) {
      throw new Error("Photo exceeds the 10 MB source size limit.");
    }
  }

  return photos;
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function buildPhotoStoragePath(input: {
  tutorId: string;
  studentId: string;
  lessonId: string;
  submissionId: string;
  photoId: string;
  ext: string;
}): string {
  return [
    `tutor_${input.tutorId}`,
    `student_${input.studentId}`,
    `lesson_${input.lessonId}`,
    `submission_${input.submissionId}`,
    `${input.photoId}.${input.ext}`,
  ].join("/");
}

function assertStoragePathAllowed(
  storagePath: string,
  tutorId: string,
  studentId: string,
  lessonId: string,
): void {
  const requiredPrefix = `tutor_${tutorId}/student_${studentId}/lesson_${lessonId}/submission_pending/`;
  if (!storagePath.startsWith(requiredPrefix)) {
    throw new Error("Invalid photo storage path.");
  }
}

function calculateLateDays(deadline: string | null, submittedAt: Date): number | null {
  if (!deadline) return null;

  const deadlineDate = new Date(`${deadline}T00:00:00.000Z`);
  const submittedDate = new Date(
    Date.UTC(submittedAt.getUTCFullYear(), submittedAt.getUTCMonth(), submittedAt.getUTCDate()),
  );

  const diffMs = submittedDate.getTime() - deadlineDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
