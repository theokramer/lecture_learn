# Local Document Storage Implementation

## Overview
Documents in the Flutter app are now stored locally on the device instead of in Supabase storage. This reduces storage costs while maintaining full compatibility with the website.

## Implementation Details

### Local Storage
- Documents are stored in the app's documents directory: `{appDocumentsDir}/documents/{userId}/{timestamp}_{filename}`
- Local paths are identified with the prefix `local://` in the database
- The `LocalDocumentService` manages all local file operations

### Path Convention
- **Local paths**: `local:///path/to/file` (stored in `storage_path` column)
- **Remote paths**: `{userId}/{filename}` (Supabase storage paths, for website compatibility)

### Audio Transcription
- Audio files are temporarily uploaded to Supabase storage for transcription
- After transcription completes, the temporary file is deleted from storage
- The original file remains stored locally on the device
- Only the transcription text and study content are stored in Supabase

### Database Schema
No schema changes are required. The existing `storage_path` column in the `documents` table is used for both:
- Local paths (prefixed with `local://`)
- Remote paths (Supabase storage paths, for website compatibility)

### Compatibility
- **Flutter App**: Stores documents locally, uses `local://` prefix
- **Website**: Continues to use Supabase storage paths
- Both can coexist in the same database
- The `Document.isLocal` property checks if a document is stored locally

### File Access
- Local files are accessed via `LocalDocumentService.getFile(pathIdentifier)`
- Remote files are accessed via Supabase storage URLs
- The `SupabaseService.getFileUrl()` method handles both cases automatically

## Benefits
1. **Reduced Storage Costs**: Documents are stored on-device, not in cloud storage
2. **Faster Access**: Local files load instantly without network requests
3. **Offline Support**: Documents are available even without internet connection
4. **Backward Compatible**: Website continues to work with existing storage paths

## Migration Notes
- Existing documents with Supabase storage paths will continue to work
- New documents uploaded from the Flutter app will use local storage
- Documents uploaded from the website will continue to use Supabase storage
- No data migration is required

