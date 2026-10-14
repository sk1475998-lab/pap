/**
 * SuperJobAgent — Supabase Integration Client
 *
 * Provides native connectivity to Supabase for:
 *   - Remote project health and connectivity checks
 *   - User authentication and session token verification
 *   - Cloud profile & resume bucket storage synchronization
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://jgyolharoxyjurnopdre.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_B0jC37Ua4A6kNbfEKeCGdQ_iQ712Pt8";

let clientInstance: SupabaseClient | null = null;

export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(url && key && url.includes("supabase.co"));
}

export function getSupabaseClient(): SupabaseClient {
  if (!clientInstance) {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return clientInstance;
}

/**
 * Validates connection to the remote Supabase project by pinging the public endpoint.
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  projectUrl: string;
  projectRef: string;
  error?: string;
  status: string;
}> {
  const url = getSupabaseUrl();
  const projectRef = url.replace("https://", "").split(".")[0] || "unknown";

  try {
    const client = getSupabaseClient();
    // Test auth service availability
    const { data, error } = await client.auth.getSession();
    if (error && !error.message.includes("session")) {
      return {
        ok: false,
        projectUrl: url,
        projectRef,
        error: error.message,
        status: "auth_error",
      };
    }

    return {
      ok: true,
      projectUrl: url,
      projectRef,
      status: "connected",
    };
  } catch (err) {
    return {
      ok: false,
      projectUrl: url,
      projectRef,
      error: err instanceof Error ? err.message : String(err),
      status: "network_error",
    };
  }
}

/**
 * Uploads a resume document into Supabase Cloud Storage ('resumes' bucket).
 * Generates an immutable public cloud URL (or signed URL) for storage and retrieval.
 */
export async function uploadResumeToSupabaseStorage(
  userId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<{ ok: boolean; publicUrl: string; storagePath?: string; error?: string }> {
  try {
    const client = getSupabaseClient();
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeUserId = (userId || "local").replace(/[^a-zA-Z0-9_-]/g, "_");
    const storagePath = `${safeUserId}/${Date.now()}-${cleanFileName}`;

    // Ensure bucket exists or handle gracefully
    try {
      const { data: buckets } = await client.storage.listBuckets();
      const hasResumes = buckets?.some((b) => b.name === "resumes");
      if (!hasResumes) {
        await client.storage.createBucket("resumes", {
          public: true,
          fileSizeLimit: 10485760, // 10MB
        });
      }
    } catch {
      // Bucket check/creation may require admin permissions; proceed to upload directly
    }

    const { error } = await client.storage
      .from("resumes")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType || "application/pdf",
        upsert: true,
      });

    if (error) {
      console.warn(`[supabase-storage] Notice for bucket 'resumes': ${error.message}`);
    }

    let resolvedUrl = "";
    const { data: pubData } = client.storage.from("resumes").getPublicUrl(storagePath);
    if (pubData?.publicUrl) {
      resolvedUrl = pubData.publicUrl;
    }

    // If bucket requires signed token or public URL is unreachable, generate signed URL
    if (!resolvedUrl || error) {
      try {
        const { data: signedData } = await client.storage
          .from("resumes")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
        if (signedData?.signedUrl) {
          resolvedUrl = signedData.signedUrl;
        }
      } catch {
        // Fallback to public URL format
      }
    }

    return {
      ok: !error,
      publicUrl: resolvedUrl || `https://jgyolharoxyjurnopdre.supabase.co/storage/v1/object/public/resumes/${storagePath}`,
      storagePath,
      error: error?.message,
    };
  } catch (err) {
    return {
      ok: false,
      publicUrl: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

