import 'dart:io';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as path;
import '../utils/logger.dart';
import '../utils/environment.dart';

/// Service for uploading files to Salad S4 storage
class SaladStorageService {
  static final SaladStorageService _instance = SaladStorageService._internal();
  factory SaladStorageService() => _instance;
  SaladStorageService._internal();

  // Get from environment or use default
  String get _apiKey => Environment.saladApiKey;
  String get _organizationName => Environment.saladOrganizationName;

  /// Upload an audio file to Salad S4 storage and get a signed URL
  /// Returns the signed URL that can be used for transcription
  Future<String> uploadAudioFile(File audioFile, {String? mimeType}) async {
    try {
      // Determine MIME type from file extension if not provided
      final fileMimeType = mimeType ?? _getMimeType(audioFile.path);
      
      // Generate file name for S4 storage
      final s4FileName = 'audio/${path.basename(audioFile.path)}';
      final uploadUrl = 'https://storage-api.salad.com/organizations/$_organizationName/files/$s4FileName';
      final localFileName = path.basename(audioFile.path);

      AppLogger.debug('Uploading to Salad S4: $s4FileName', tag: 'SaladStorageService');

      // Prepare headers
      final headers = {
        'Salad-Api-Key': _apiKey,
      };

      // Prepare form data
      final request = http.MultipartRequest('PUT', Uri.parse(uploadUrl));
      request.headers.addAll(headers);
      
      // Add form fields
      request.fields['mimeType'] = fileMimeType;
      request.fields['sign'] = 'true'; // Request a signed URL
      request.fields['signatureExp'] = (3 * 24 * 60 * 60).toString(); // 3 days in seconds

      // Read file as bytes to avoid content-length calculation issues
      // Using fromBytes instead of fromPath prevents content-length mismatch errors
      final fileBytes = await audioFile.readAsBytes();
      
      // Add file using bytes instead of fromPath to avoid content-length mismatch
      request.files.add(
        http.MultipartFile.fromBytes(
          'file',
          fileBytes,
          filename: localFileName,
        ),
      );

      // Send request
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode != 200 && response.statusCode != 201) {
        AppLogger.error('Failed to upload to Salad S4', error: response.body, tag: 'SaladStorageService');
        throw Exception('Failed to upload to Salad S4: ${response.statusCode} ${response.body}');
      }

      // Parse response to get signed URL
      final responseData = jsonDecode(response.body) as Map<String, dynamic>;
      final signedUrl = responseData['url'] as String?;

      if (signedUrl == null || signedUrl.isEmpty) {
        throw Exception('Signed URL not returned by Salad S4 API');
      }

      AppLogger.success('Uploaded to Salad S4, signed URL obtained', tag: 'SaladStorageService');
      return signedUrl;
    } catch (e) {
      AppLogger.error('Error uploading to Salad S4', error: e, tag: 'SaladStorageService');
      rethrow;
    }
  }

  /// Get MIME type from file extension
  String _getMimeType(String filePath) {
    final extension = filePath.split('.').last.toLowerCase();
    switch (extension) {
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'm4a':
        return 'audio/m4a';
      case 'webm':
        return 'audio/webm';
      case 'ogg':
        return 'audio/ogg';
      case 'flac':
        return 'audio/flac';
      case 'mp4':
        return 'audio/mp4';
      default:
        return 'audio/mpeg'; // Default to mp3
    }
  }
}

