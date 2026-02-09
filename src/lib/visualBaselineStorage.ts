import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = 'visual-baselines';

/**
 * Upload a baseline image to Supabase Storage
 * Returns the storage path (not a URL)
 */
export async function uploadBaselineToStorage(
  testId: string,
  stepId: string,
  base64Image: string
): Promise<{ storagePath: string | null; error: string | null }> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert base64 to Uint8Array
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Generate unique file path
    const timestamp = Date.now();
    const fileName = `${testId}/${stepId}_${timestamp}.png`;
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, binaryData, {
        contentType: 'image/png',
        upsert: true, // Allow overwriting
      });
    
    if (uploadError) {
      console.error('Failed to upload baseline to storage:', uploadError);
      return { storagePath: null, error: uploadError.message };
    }
    
    return { storagePath: uploadData.path, error: null };
  } catch (err: any) {
    console.error('Error uploading baseline:', err);
    return { storagePath: null, error: err.message };
  }
}

/**
 * Get a signed URL for a baseline image from storage
 * Returns a URL that can be used to display the image
 */
export async function getBaselineUrl(storagePath: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
    
    return data?.signedUrl || null;
  } catch (err) {
    console.error('Error getting baseline URL:', err);
    return null;
  }
}

/**
 * Get the baseline image data - either from storage URL or base64
 * This handles backwards compatibility with existing base64 baselines
 */
export async function getBaselineImage(
  baselineImage: string,
  baselineType: string | null,
  baselineStoragePath: string | null
): Promise<string> {
  // If it's a storage type and we have a path, get the signed URL
  if (baselineType === 'storage' && baselineStoragePath) {
    const url = await getBaselineUrl(baselineStoragePath);
    return url || baselineImage; // Fallback to original if URL fails
  }
  
  // Otherwise return the original (base64 or existing URL)
  return baselineImage;
}

/**
 * Delete a baseline image from storage
 */
export async function deleteBaselineFromStorage(storagePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);
    
    if (error) {
      console.error('Failed to delete baseline from storage:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error deleting baseline:', err);
    return false;
  }
}

/**
 * Migrate a single baseline from base64 to storage
 */
export async function migrateBaselineToStorage(
  testId: string,
  stepId: string,
  base64Image: string
): Promise<{ success: boolean; storagePath: string | null; error: string | null }> {
  // Upload to storage
  const { storagePath, error } = await uploadBaselineToStorage(testId, stepId, base64Image);
  
  if (error || !storagePath) {
    return { success: false, storagePath: null, error };
  }
  
  // Update the database record
  const { error: updateError } = await supabase
    .from('nocode_visual_baselines')
    .update({
      baseline_storage_path: storagePath,
      baseline_type: 'storage',
      // Keep the original base64 for now as fallback, will be cleared later
    })
    .eq('test_id', testId)
    .eq('step_id', stepId);
  
  if (updateError) {
    console.error('Failed to update baseline record:', updateError);
    return { success: false, storagePath, error: updateError.message };
  }
  
  return { success: true, storagePath, error: null };
}

/**
 * Migrate all existing base64 baselines to storage
 * Returns count of migrated and failed baselines
 */
export async function migrateAllBaselinesToStorage(): Promise<{
  migrated: number;
  failed: number;
  errors: string[];
}> {
  const result = { migrated: 0, failed: 0, errors: [] as string[] };
  
  // Fetch all baselines that are still base64
  const { data: baselines, error: fetchError } = await supabase
    .from('nocode_visual_baselines')
    .select('id, test_id, step_id, baseline_image, baseline_type')
    .or('baseline_type.is.null,baseline_type.eq.base64');
  
  if (fetchError) {
    result.errors.push(`Failed to fetch baselines: ${fetchError.message}`);
    return result;
  }
  
  if (!baselines || baselines.length === 0) {
    return result;
  }
  
  // Migrate each baseline
  for (const baseline of baselines) {
    // Skip if no base64 image or already a URL
    if (!baseline.baseline_image || baseline.baseline_image.startsWith('http')) {
      continue;
    }
    
    const { success, error } = await migrateBaselineToStorage(
      baseline.test_id,
      baseline.step_id,
      baseline.baseline_image
    );
    
    if (success) {
      result.migrated++;
    } else {
      result.failed++;
      result.errors.push(`Failed to migrate baseline ${baseline.id}: ${error}`);
    }
  }
  
  return result;
}

/**
 * Clear base64 data from baselines that have been migrated to storage
 * This should be called after confirming storage migration is working
 */
export async function clearMigratedBaselineBase64Data(): Promise<number> {
  const { data, error } = await supabase
    .from('nocode_visual_baselines')
    .update({ baseline_image: '' })
    .eq('baseline_type', 'storage')
    .not('baseline_storage_path', 'is', null)
    .select('id');
  
  if (error) {
    console.error('Failed to clear base64 data:', error);
    return 0;
  }
  
  return data?.length || 0;
}
