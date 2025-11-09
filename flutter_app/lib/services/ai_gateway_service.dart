import 'dart:io';
import 'dart:convert';
import 'supabase_service.dart';

class RateLimitError implements Exception {
  final String code;
  final String message;
  final int? limit;
  final int? remaining;
  final String? resetAt;

  RateLimitError({
    required this.code,
    required this.message,
    this.limit,
    this.remaining,
    this.resetAt,
  });

  @override
  String toString() => message;
}

class AIGatewayService {
  static final AIGatewayService _instance = AIGatewayService._internal();
  factory AIGatewayService() => _instance;
  AIGatewayService._internal();

  final _supabase = SupabaseService();

  Future<void> checkRateLimit(String userId, String? email) async {
    // Rate limit is checked by the Edge Function itself
    // This is a placeholder for client-side pre-checks if needed
    return;
  }

  /// Transcribe audio using Supabase Edge Function
  /// Matches the website's implementation exactly
  Future<String> transcribeAudio(File audioFile, {String? storagePath, String? userId}) async {
    try {
      final supabase = _supabase.client;
      
      // If storage path is provided, use it (preferred method)
      if (storagePath != null && storagePath.isNotEmpty) {
        print('Using storage-based transcription for path: $storagePath');
        
        final result = await supabase.functions.invoke(
          'ai-generate',
          body: {
            'type': 'transcription',
            'storagePath': storagePath,
          },
        );

        // Handle response data
        if (result.data != null) {
          final data = result.data as Map<String, dynamic>;
          
          // Check if response contains an error
          if (data.containsKey('error')) {
            final errorMsg = data['error'] as String? ?? 'Transcription failed';
            // Check for rate limit errors in error message
            if (errorMsg.contains('DAILY_LIMIT_REACHED') || errorMsg.contains('ACCOUNT_LIMIT_REACHED')) {
              throw RateLimitError(
                code: errorMsg.contains('ACCOUNT_LIMIT_REACHED') ? 'ACCOUNT_LIMIT_REACHED' : 'DAILY_LIMIT_REACHED',
                message: errorMsg,
              );
            }
            throw Exception(errorMsg);
          }
          
          final text = data['text'] as String? ?? '';
          if (text.isEmpty) {
            throw Exception('Transcription returned empty text');
          }
          return text;
        }

        // If no data and status is not 200, it's an error
        if (result.status != 200) {
          final errorData = result.data as Map<String, dynamic>?;
          if (errorData != null) {
            final error = _extractError(errorData);
            if (error['code'] == 'DAILY_LIMIT_REACHED' || error['code'] == 'ACCOUNT_LIMIT_REACHED') {
              throw RateLimitError(
                code: error['code'] as String,
                message: error['message'] as String? ?? 'Rate limit reached',
                limit: error['limit'] as int?,
                remaining: error['remaining'] as int?,
                resetAt: error['resetAt'] as String?,
              );
            }
            throw Exception(error['message'] as String? ?? 'Transcription failed');
          }
          throw Exception('Transcription failed with status ${result.status}');
        }

        throw Exception('No transcription data received');
      }

      // Fallback to base64 for small files (< 2MB)
      final fileSize = await audioFile.length();
      const storageThreshold = 2 * 1024 * 1024; // 2 MB

      if (fileSize > storageThreshold) {
        if (userId == null) {
          throw Exception('UserId required for large audio file transcription');
        }
        // Upload to storage first, then transcribe
        final uploadedPath = await _supabase.uploadFile(userId, audioFile);
        return transcribeAudio(audioFile, storagePath: uploadedPath, userId: userId);
      }

      // Use base64 for small files
      print('Using direct base64 transcription for small file ($fileSize bytes)');
      final bytes = await audioFile.readAsBytes();
      final base64 = base64Encode(bytes);
      final mimeType = 'audio/m4a'; // Adjust based on file type

      final result = await supabase.functions.invoke(
        'ai-generate',
        body: {
          'type': 'transcription',
          'audioBase64': base64,
          'mimeType': mimeType,
        },
      );

      // Handle response data
      if (result.data != null) {
        final data = result.data as Map<String, dynamic>;
        
        // Check if response contains an error
        if (data.containsKey('error')) {
          final errorMsg = data['error'] as String? ?? 'Transcription failed';
          // Check for rate limit errors in error message
          if (errorMsg.contains('DAILY_LIMIT_REACHED') || errorMsg.contains('ACCOUNT_LIMIT_REACHED')) {
            throw RateLimitError(
              code: errorMsg.contains('ACCOUNT_LIMIT_REACHED') ? 'ACCOUNT_LIMIT_REACHED' : 'DAILY_LIMIT_REACHED',
              message: errorMsg,
            );
          }
          throw Exception(errorMsg);
        }
        
        final text = data['text'] as String? ?? '';
        if (text.isEmpty) {
          throw Exception('Transcription returned empty text');
        }
        return text;
      }

      // If no data and status is not 200, it's an error
      if (result.status != 200) {
        final errorData = result.data as Map<String, dynamic>?;
        if (errorData != null) {
          final error = _extractError(errorData);
          if (error['code'] == 'DAILY_LIMIT_REACHED' || error['code'] == 'ACCOUNT_LIMIT_REACHED') {
            throw RateLimitError(
              code: error['code'] as String,
              message: error['message'] as String? ?? 'Rate limit reached',
              limit: error['limit'] as int?,
              remaining: error['remaining'] as int?,
              resetAt: error['resetAt'] as String?,
            );
          }
          throw Exception(error['message'] as String? ?? 'Transcription failed');
        }
        throw Exception('Transcription failed with status ${result.status}');
      }

      throw Exception('No transcription data received');
    } catch (e) {
      if (e is RateLimitError) {
        rethrow;
      }
      final errorMessage = e.toString();
      print('Transcription error: $errorMessage');
      throw Exception('Failed to transcribe audio: $errorMessage');
    }
  }

  /// Generate intelligent summary (matches website's generateIntelligentSummary)
  Future<String> generateSummary(String content, {List<Map<String, dynamic>>? documents, String detailLevel = 'standard'}) async {
    try {
      // Build balanced context (simplified version - website uses buildBalancedContext)
      // Increased limits for comprehensive summaries to allow more context
      final balancedContent = _truncateContent(content, detailLevel == 'concise' ? 1800 : detailLevel == 'comprehensive' ? 5000 : 2600);
      
      // Determine chunk size based on detail level
      // Increased chunk size for comprehensive to maintain more context
      final chunkSize = detailLevel == 'concise' ? 900 : detailLevel == 'comprehensive' ? 2500 : 1300;
      
      // Split into chunks if content is very long
      final chunks = _splitIntoChunksByWords(balancedContent, chunkSize);
      
      if (chunks.length > 1) {
        // Generate partial summaries for each chunk
        final partialSummaries = <String>[];
        for (int i = 0; i < chunks.length; i++) {
          final partPrompt = _generateSummaryUserPrompt(
            chunks[i],
            documents: documents,
            detailLevel: detailLevel,
            partInfo: {'index': i + 1, 'total': chunks.length},
          );
          
          final partRaw = await chatCompletion([
            {'role': 'system', 'content': _generateSummarySystemPrompt(detailLevel)},
            {'role': 'user', 'content': partPrompt},
          ], model: 'gpt-4o-mini', temperature: 0.7);
          
          partialSummaries.add(_sanitizeHtmlOutput(partRaw));
        }
        
        // Merge partial summaries
        final mergePrompt = _generateSummaryMergePrompt(partialSummaries, detailLevel);
        final mergedRaw = await chatCompletion([
          {'role': 'system', 'content': _generateSummarySystemPrompt(detailLevel)},
          {'role': 'user', 'content': mergePrompt},
        ], model: 'gpt-4o-mini', temperature: 0.5);
        
        return _sanitizeHtmlOutput(mergedRaw);
      } else {
        // Single chunk - generate summary directly
        final userPrompt = _generateSummaryUserPrompt(
          balancedContent,
          documents: documents,
          detailLevel: detailLevel,
        );
        
        final raw = await chatCompletion([
          {'role': 'system', 'content': _generateSummarySystemPrompt(detailLevel)},
          {'role': 'user', 'content': userPrompt},
        ], model: 'gpt-4o-mini', temperature: 0.7);
        
        return _sanitizeHtmlOutput(raw);
      }
    } catch (e) {
      if (e is RateLimitError) rethrow;
      print('Error generating summary: $e');
      throw Exception('Failed to generate summary: $e');
    }
  }

  String _generateSummarySystemPrompt(String detailLevel) {
    final isComprehensive = detailLevel == 'comprehensive';
    return '''You are an expert educational content summarizer. Create a ${isComprehensive ? 'highly detailed and comprehensive' : detailLevel == 'concise' ? 'brief and focused' : 'balanced and informative'} summary in HTML format.

Requirements:
- Use proper HTML tags (p, h2, h3, h4, ul, ol, li, strong, em, blockquote, etc.)
- Structure the summary with clear sections and subsections
- ${isComprehensive ? 'Cover ALL aspects of the content in detail:\n  - Include ALL key concepts, main points, and important details\n  - Explain concepts thoroughly so users can fully understand\n  - Include examples, explanations, and context where relevant\n  - Cover all topics, themes, and subtopics mentioned\n  - Provide detailed explanations, not just brief mentions\n  - Include relationships between concepts\n  - Explain terminology and technical terms\n  - Cover all documents and their contents comprehensively' : 'Include key concepts, main points, and important details'}
- Use headings (h2, h3, h4) to organize content logically with clear hierarchy
- Highlight important terms and concepts with <strong> tags
- ${isComprehensive ? 'Be thorough and detailed - aim for completeness. The user should be able to understand the material fully from your summary alone.' : 'Be informative and clear'}
- Return ONLY valid HTML, no markdown or code fences''';
  }

  String _generateSummaryUserPrompt(
    String content, {
    List<Map<String, dynamic>>? documents,
    String detailLevel = 'standard',
    Map<String, dynamic>? partInfo,
  }) {
    final docInfo = documents != null && documents.isNotEmpty
        ? 'Documents: ${documents.take(6).map((d) => '${d['name']} [${d['type']}]').join(', ')}'
        : 'No additional documents';
    
    final partText = partInfo != null
        ? '\n\nThis is part ${partInfo['index']} of ${partInfo['total']} parts. Focus on this section while maintaining context.'
        : '';
    
    final wordTarget = detailLevel == 'concise' ? '400-800' : detailLevel == 'comprehensive' ? '2500-4000' : '900-1500';
    
    final comprehensiveInstructions = detailLevel == 'comprehensive' ? '''

CRITICAL INSTRUCTIONS FOR COMPREHENSIVE SUMMARY:
- Cover EVERY aspect of the content in detail - nothing should be left out
- Explain concepts thoroughly so the user can fully understand without referring to the original
- Include ALL key points, details, examples, and explanations from the content
- Cover all topics, subtopics, and themes comprehensively
- Provide detailed explanations for technical terms and concepts
- Include context and relationships between different ideas
- Make sure the summary is detailed enough that the user can learn from it independently
- Organize content into clear sections covering all major topics
- Be thorough and complete - prioritize comprehensiveness over brevity''' : '';
    
    return '''Create a ${detailLevel} summary of the following content in HTML format.$comprehensiveInstructions

Content:
$content

$docInfo$partText

Target length: $wordTarget words.
${detailLevel == 'comprehensive' ? 'Aim for the higher end of the word range to ensure comprehensive coverage.' : ''}
Return ONLY valid HTML content, no markdown or code fences.''';
  }

  String _generateSummaryMergePrompt(List<String> partialSummaries, String detailLevel) {
    final wordTarget = detailLevel == 'concise' ? '400-800' : detailLevel == 'comprehensive' ? '2500-4000' : '900-1500';
    final isComprehensive = detailLevel == 'comprehensive';
    
    return '''Merge the following partial summaries into a single, coherent, ${isComprehensive ? 'highly detailed and comprehensive' : 'comprehensive'} summary in HTML format.

Partial Summaries:
${partialSummaries.asMap().entries.map((e) => 'Part ${e.key + 1}:\n${e.value}').join('\n\n')}

Requirements:
- Combine all parts into a unified summary
- ${isComprehensive ? 'Preserve ALL details from all parts - do not omit information' : 'Remove redundancy and overlap while preserving important details'}
- Maintain logical flow and structure with clear sections
- Use proper HTML formatting (h2, h3, h4, p, ul, ol, li, strong, em)
- ${isComprehensive ? 'Ensure comprehensive coverage - include all topics, concepts, and details from all parts' : 'Maintain key information from all parts'}
- Target length: $wordTarget words${isComprehensive ? ' (aim for higher end to ensure completeness)' : ''}
- Return ONLY valid HTML content, no markdown or code fences.''';
  }

  String _sanitizeHtmlOutput(String content) {
    String result = content.trim();
    
    // Remove markdown code fences
    final fencedMatch = RegExp(r'```(?:html)?\s*([\s\S]*?)```', caseSensitive: false).firstMatch(result);
    if (fencedMatch != null) {
      result = fencedMatch.group(1)!.trim();
    }
    
    // Strip wrapping quotes
    if ((result.startsWith('"') && result.endsWith('"')) ||
        (result.startsWith("'") && result.endsWith("'"))) {
      result = result.substring(1, result.length - 1).trim();
    }
    
    // Remove quotes inside <p> tags (simplified - remove quotes after <p> and before </p>)
    // Note: This is a simplified version - the website has more complex logic
    result = result.replaceAll(RegExp(r'<p>\s*["'']'), '<p>');
    result = result.replaceAll(RegExp(r'["'']\s*</p>'), '</p>');
    
    return result;
  }

  List<String> _splitIntoChunksByWords(String text, int maxWords) {
    final words = text.split(RegExp(r'\s+'));
    if (words.length <= maxWords) return [text];
    
    final chunks = <String>[];
    for (int i = 0; i < words.length; i += maxWords) {
      final end = (i + maxWords < words.length) ? i + maxWords : words.length;
      chunks.add(words.sublist(i, end).join(' '));
    }
    return chunks;
  }

  /// Generate title using chat completion (matches website's generatePerfectTitle)
  Future<String> generateTitle(String content, {List<Map<String, String>>? documents}) async {
    try {
      final trimmed = content.trim();
      if (trimmed.isEmpty) return 'New Note';

      final docNames = documents?.take(6).map((d) => '${d['name']} [${d['type']}]').join(', ') ?? 'none';

      const system = '''You are an expert copywriter. Create a short, keyword-focused title from provided content. 
Rules:  
- 2-4 words MAXIMUM, Title Case  
- Extract ONLY the essential keywords that define the core topic/subject
- No articles (a, an, the) unless necessary
- No quotes, no punctuation at end  
- Focus on the main subject/topic keywords only
- Must fit in a mobile navigation bar (max 35 characters)
- Be concise and keyword-focused, not descriptive
- Prefer content keywords over filenames if they conflict
- Examples: "Machine Learning Basics", "Quantum Physics", "Python Programming", "World War II"''';

      final user = 'Content:\n${_truncateContent(trimmed, 1000)}\n\nDocuments: $docNames\n\nExtract the 2-4 most important keywords that define this content. Return ONLY the title (2-4 words max).';

      final title = await chatCompletion([
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': user},
      ], model: 'gpt-4o-mini', temperature: 0.3);

      var finalTitle = title.trim();
      // Strip wrapping quotes/backticks if any
      if ((finalTitle.startsWith('"') && finalTitle.endsWith('"')) ||
          (finalTitle.startsWith("'") && finalTitle.endsWith("'"))) {
        finalTitle = finalTitle.substring(1, finalTitle.length - 1).trim();
      }
      finalTitle = finalTitle.replaceAll(RegExp(r'^`+|`+$'), '').trim();

      // Enforce short length for navigation bar (max 35 characters)
      if (finalTitle.length > 35) {
        // Take first 35 chars and remove partial word
        finalTitle = finalTitle.substring(0, 35).trim();
        final words = finalTitle.split(RegExp(r'\s+'));
        if (words.length > 1) {
          // Remove last word if it might be cut off
          finalTitle = words.take(words.length - 1).join(' ');
        }
      }
      
      // Ensure it's 2-4 words max
      final words = finalTitle.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
      if (words.length > 4) {
        finalTitle = words.take(4).join(' ');
      }
      
      if (finalTitle.isEmpty) return 'New Note';
      return finalTitle.replaceAll(RegExp(r'[\.!?\s]+$'), '');
    } catch (e) {
      print('Error generating title: $e');
      return 'New Note';
    }
  }

  /// Chat completion using Supabase Edge Function
  /// Matches the website's implementation exactly
  Future<String> chatCompletion(
    List<Map<String, String>> messages, {
    String model = 'gpt-4o-mini',
    double temperature = 0.7,
  }) async {
    try {
      final supabase = _supabase.client;

      final result = await supabase.functions.invoke(
        'ai-generate',
        body: {
          'type': 'chat',
          'messages': messages,
          'model': model,
          'temperature': temperature,
        },
      );

      // Handle response data - Supabase functions.invoke returns data directly on success
      if (result.data != null) {
        final data = result.data as Map<String, dynamic>;
        
        // Check if response contains an error
        if (data.containsKey('error')) {
          final errorMsg = data['error'] as String? ?? 'Chat completion failed';
          // Check for rate limit errors in error message
          if (errorMsg.contains('DAILY_LIMIT_REACHED') || errorMsg.contains('ACCOUNT_LIMIT_REACHED')) {
            throw RateLimitError(
              code: errorMsg.contains('ACCOUNT_LIMIT_REACHED') ? 'ACCOUNT_LIMIT_REACHED' : 'DAILY_LIMIT_REACHED',
              message: errorMsg,
            );
          }
          throw Exception(errorMsg);
        }
        
        // Extract content from response
        final content = data['content'] as String?;
        if (content == null || content.isEmpty) {
          throw Exception('Chat completion returned empty content');
        }
        return content;
      }

      // If no data, check status code
      if (result.status != 200) {
        // Try to extract error from result
        final errorData = result.data;
        if (errorData != null) {
          final error = _extractError(errorData);
          final errorCode = error['code'] as String?;
          if (errorCode == 'DAILY_LIMIT_REACHED' || errorCode == 'ACCOUNT_LIMIT_REACHED') {
            throw RateLimitError(
              code: errorCode!,
              message: error['message'] as String? ?? 'Rate limit reached',
              limit: error['limit'] as int?,
              remaining: error['remaining'] as int?,
              resetAt: error['resetAt'] as String?,
            );
          }
          throw Exception(error['message'] as String? ?? 'Chat completion failed');
        }
        throw Exception('Chat completion failed with status ${result.status}');
      }

      throw Exception('No chat completion data received');
    } catch (e) {
      if (e is RateLimitError) {
        rethrow;
      }
      // Check if it's a Supabase FunctionException
      if (e.toString().contains('FunctionException')) {
        // Try to parse the error details
        final errorStr = e.toString();
        if (errorStr.contains('DAILY_LIMIT_REACHED') || errorStr.contains('ACCOUNT_LIMIT_REACHED')) {
          throw RateLimitError(
            code: errorStr.contains('ACCOUNT_LIMIT_REACHED') ? 'ACCOUNT_LIMIT_REACHED' : 'DAILY_LIMIT_REACHED',
            message: 'Rate limit reached',
          );
        }
      }
      final errorMessage = e.toString();
      print('Chat completion error: $errorMessage');
      throw Exception('Failed to complete chat: $errorMessage');
    }
  }

  /// Generate flashcards using chat completion (matches website's generateFlashcards)
  Future<List<Map<String, dynamic>>> generateFlashcards(String content, {int count = 20}) async {
    try {
      final messages = [
        {
          'role': 'system',
          'content': 'You are a helpful assistant that creates educational flashcards. Return a JSON array of flashcards with "front" and "back" properties.',
        },
        {
          'role': 'user',
          'content': 'Create EXACTLY $count flashcards from the following materials. Requirements:\n1. Give EQUAL coverage to all documents; do not focus only on early sections\n2. Progress difficulty (definitions/facts → concepts/relationships → applications)\n3. Ensure breadth across distinct topics; avoid redundancy\n4. If multiple documents state the same fact, MERGE that into one clear card (do not duplicate) and prefer the clearest wording\n\nMaterials:\n${_truncateContent(content, 1500)}\n\nReturn exactly $count flashcards as a JSON array with "front" and "back" properties.',
        },
      ];

      final response = await chatCompletion(messages, model: 'gpt-4o-mini', temperature: 0.7);
      final jsonContent = _extractJSON(response);
      final flashcards = jsonDecode(jsonContent) as List;
      
      return flashcards.cast<Map<String, dynamic>>().take(count).toList();
    } catch (e) {
      if (e is RateLimitError) rethrow;
      print('Error generating flashcards: $e');
      throw Exception('Failed to generate flashcards: $e');
    }
  }

  /// Generate quiz questions using chat completion (matches website's generateQuiz)
  Future<List<Map<String, dynamic>>> generateQuiz(String content, {int count = 15}) async {
    try {
      final messages = [
        {
          'role': 'system',
          'content': 'You are a helpful assistant that creates quiz questions. Return a JSON array of questions with "question", "options" (array of 4 strings), and "correctAnswer" (index 0-3).',
        },
        {
          'role': 'user',
          'content': 'Create EXACTLY $count quiz questions from the following materials. Requirements:\n1. Give EQUAL coverage to all documents; do not bias earlier sections\n2. Mix difficulty (recall → application → analysis) and cover different topics\n3. Make distractors plausible but clearly wrong\n4. If multiple documents repeat the same fact, combine knowledge and avoid duplicate questions\n\nMaterials:\n${_truncateContent(content, 1500)}\n\nReturn exactly $count quiz questions as a JSON array with "question", "options" (array of 4 strings), and "correctAnswer" (index 0-3).',
        },
      ];

      final response = await chatCompletion(messages, model: 'gpt-4o-mini', temperature: 0.7);
      final jsonContent = _extractJSON(response);
      final questions = jsonDecode(jsonContent) as List;
      
      return questions.cast<Map<String, dynamic>>().take(count).toList();
    } catch (e) {
      if (e is RateLimitError) rethrow;
      print('Error generating quiz: $e');
      throw Exception('Failed to generate quiz: $e');
    }
  }

  /// Generate exercises using chat completion (matches website's generateExercise)
  Future<List<Map<String, dynamic>>> generateExercises(String content, {int count = 10}) async {
    try {
      final messages = [
        {
          'role': 'system',
          'content': 'You are a helpful assistant that creates practice exercises. Return a JSON array of exercises with "question", "solution", and "notes" properties.',
        },
        {
          'role': 'user',
          'content': 'Create EXACTLY $count practice exercises from the following text. Make sure to:\n1. Cover ALL important concepts and key topics from the text comprehensively\n2. Create exercises in progressive difficulty (start with simpler applications, then more complex ones)\n3. Include a variety of exercise types:\n   - Problem-solving exercises\n   - Application of concepts\n   - Analysis and critical thinking\n   - Synthesis tasks\n4. Each exercise should have a clear, detailed solution\n5. Include helpful notes with tips or common pitfalls\n6. Ensure comprehensive coverage across different themes and topics\n\nText:\n${_truncateContent(content, 2000)}\n\nReturn exactly $count exercises as a JSON array with "question", "solution", and "notes" properties.',
        },
      ];

      final response = await chatCompletion(messages, model: 'gpt-4o-mini', temperature: 0.7);
      final jsonContent = _extractJSON(response);
      final exercises = jsonDecode(jsonContent) as List;
      
      return exercises.cast<Map<String, dynamic>>().take(count).toList();
    } catch (e) {
      if (e is RateLimitError) rethrow;
      print('Error generating exercises: $e');
      throw Exception('Failed to generate exercises: $e');
    }
  }


  /// Detect link type (Google Drive, web, or unknown)
  /// Excludes YouTube links
  String detectLinkType(String url) {
    final normalizedUrl = url.toLowerCase().trim();
    
    // Reject YouTube links
    if (normalizedUrl.contains('youtube.com') || normalizedUrl.contains('youtu.be')) {
      return 'youtube';
    }
    
    // Check for Google Drive
    if (normalizedUrl.contains('drive.google.com') || 
        normalizedUrl.contains('docs.google.com') ||
        normalizedUrl.contains('sheets.google.com') ||
        normalizedUrl.contains('slides.google.com') ||
        normalizedUrl.contains('forms.google.com')) {
      return 'google-drive';
    }
    
    // Check for valid web URL
    if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
      return 'web';
    }
    
    return 'unknown';
  }

  /// Process web link (Google Drive or web page)
  /// Rejects YouTube links
  Future<Map<String, dynamic>> processWebLink(String url, {String? userId}) async {
    try {
      final supabase = _supabase.client;
      
      print('🔗 [AIGatewayService] Processing web link: $url');
      
      // Detect link type
      final linkType = detectLinkType(url);
      
      // Reject YouTube links
      if (linkType == 'youtube') {
        throw Exception('YouTube videos are not supported. Please use a different link.');
      }
      
      print('🔍 [AIGatewayService] Detected link type: $linkType');
      
      // Process via backend Edge Function
      final Map<String, dynamic> requestBody = {
        'url': url,
        'type': linkType,
      };
      
      final result = await supabase.functions.invoke(
        'process-link',
        body: requestBody,
      );

      // Handle response data
      if (result.data != null) {
        final data = result.data as Map<String, dynamic>;
        
        // Check if response contains an error
        if (data.containsKey('error')) {
          final errorMsg = data['error'] as String? ?? 'Link processing failed';
          // Check for rate limit errors
          if (errorMsg.contains('DAILY_LIMIT_REACHED') || errorMsg.contains('ACCOUNT_LIMIT_REACHED')) {
            throw RateLimitError(
              code: errorMsg.contains('ACCOUNT_LIMIT_REACHED') ? 'ACCOUNT_LIMIT_REACHED' : 'DAILY_LIMIT_REACHED',
              message: errorMsg,
            );
          }
          throw Exception(errorMsg);
        }
        
        // Handle 'content' field
        final content = data['content'] as String? ?? '';
        final title = data['title'] as String? ?? 'Web Link';
        
        if (content.isEmpty) {
          throw Exception('Link processing returned empty content.');
        }
        
        print('✅ [AIGatewayService] Link processed successfully. Title: $title, Content length: ${content.length}');
        
        return {
          'title': title,
          'content': content,
          'sourceUrl': url,
          'sourceType': linkType,
        };
      }

      // If no data and status is not 200, it's an error
      if (result.status != 200) {
        final errorData = result.data as Map<String, dynamic>?;
        if (errorData != null) {
          final error = _extractError(errorData);
          if (error['code'] == 'DAILY_LIMIT_REACHED' || error['code'] == 'ACCOUNT_LIMIT_REACHED') {
            throw RateLimitError(
              code: error['code'] as String,
              message: error['message'] as String? ?? 'Rate limit reached',
              limit: error['limit'] as int?,
              remaining: error['remaining'] as int?,
              resetAt: error['resetAt'] as String?,
            );
          }
          throw Exception(error['message'] as String? ?? 'Link processing failed');
        }
        throw Exception('Link processing failed with status ${result.status}');
      }

      throw Exception('No link processing data received');
    } catch (e) {
      print('❌ [AIGatewayService] Error processing web link: $e');
      rethrow;
    }
  }

  /// Generate Feynman topics using chat completion (matches website's generateFeynmanTopicsHelper)
  Future<List<Map<String, dynamic>>> generateFeynmanTopics(String content) async {
    try {
      final messages = [
        {
          'role': 'system',
          'content': 'You are an educational assistant helping create practice topics.',
        },
        {
          'role': 'user',
          'content': 'Based on this note content, generate 3-4 specific topics that a student could practice explaining using the Feynman Technique. Focus on the main concepts, terms, or ideas that would be good for teaching.\n\nNote content:\n${_truncateContent(content, 1000)}\n\nReturn a JSON array of objects with "title" (short topic title starting with "Explain:") and "description" (brief description). Keep titles concise (max 50 chars).',
        },
      ];

      final response = await chatCompletion(messages, model: 'gpt-4o-mini', temperature: 0.7);
      final jsonMatch = RegExp(r'\[[\s\S]*\]').firstMatch(response);
      
      if (jsonMatch != null) {
        final topics = jsonDecode(jsonMatch.group(0)!) as List;
        return topics.asMap().entries.map((entry) {
          final topic = entry.value as Map<String, dynamic>;
          return {
            'id': (entry.key + 1).toString(),
            'title': topic['title'] ?? 'Topic ${entry.key + 1}',
            'description': topic['description'] ?? '',
          };
        }).toList();
      }
      return [];
    } catch (e) {
      if (e is RateLimitError) rethrow;
      print('Error generating feynman topics: $e');
      return [];
    }
  }

  /// Extract JSON from AI response (matches website's extractJSON)
  String _extractJSON(String response) {
    // Try to find JSON in markdown code blocks first
    final codeBlockMatch = RegExp(r'```(?:json)?\s*([\s\S]*?)```').firstMatch(response);
    if (codeBlockMatch != null) {
      return codeBlockMatch.group(1)!.trim();
    }
    
    // Try to find JSON array (more common for our use cases)
    final jsonArrayMatch = RegExp(r'\[[\s\S]*\]').firstMatch(response);
    if (jsonArrayMatch != null) {
      return jsonArrayMatch.group(0)!;
    }
    
    // Try to find JSON object
    final jsonObjectMatch = RegExp(r'\{[\s\S]*\}').firstMatch(response);
    if (jsonObjectMatch != null) {
      return jsonObjectMatch.group(0)!;
    }
    
    // If no match, return the whole response (might be pure JSON)
    return response.trim();
  }

  /// Truncate content to avoid rate limits (matches website's truncateContent)
  String _truncateContent(String content, [int maxLength = 2000]) {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  /// Extract error information from Supabase function error response
  Map<String, dynamic> _extractError(dynamic error) {
    if (error is Map<String, dynamic>) {
      final context = error['context'];
      if (context is Map<String, dynamic>) {
        return {
          'code': context['code'] ?? error['code'],
          'message': context['message'] ?? context['error'] ?? error['message'],
          'limit': context['limit'],
          'remaining': context['remaining'],
          'resetAt': context['resetAt'],
        };
      }
      return {
        'code': error['code'],
        'message': error['message'] ?? error['error'],
        'limit': error['limit'],
        'remaining': error['remaining'],
        'resetAt': error['resetAt'],
      };
    }
    if (error is String) {
      return {'message': error};
    }
    return {'message': error.toString()};
  }
}

