// Supabase Storage helpers for file uploads/downloads
import { createClient } from '@supabase/supabase-js';
import { ENV } from './_core/env';

const BUCKET = 'nervix-files';

function getSupabase() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) {
    throw new Error("Supabase credentials missing: set SUPABASE_URL and SUPABASE_SERVICE_KEY");
  }
  return createClient(ENV.supabaseUrl, ENV.supabaseServiceKey);
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const supabase = getSupabase();
  const key = normalizeKey(relKey);

  const blob = typeof data === "string"
    ? new Blob([data], { type: contentType })
    : new Blob([data as any], { type: contentType });

  const { error } = await supabase.storage.from(BUCKET).upload(key, blob, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { key, url: urlData.publicUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const supabase = getSupabase();
  const key = normalizeKey(relKey);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { key, url: urlData.publicUrl };
}
