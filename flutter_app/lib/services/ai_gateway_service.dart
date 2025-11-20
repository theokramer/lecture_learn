import 'dart:io';
import 'dart:convert';
import 'supabase_service.dart';
import '../utils/logger.dart';

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

  /// Transcribe audio using Supabase Edge Function with AssemblyAI
  /// Uploads file to Supabase storage and calls Edge Function which uses AssemblyAI
  Future<String> transcribeAudio(File audioFile, {String? storagePath, String? userId}) async {
    String? tempStoragePath;
    
    try {
      // If storage path is provided, use it; otherwise upload the file
      if (storagePath == null || storagePath.isEmpty) {
        if (userId == null) {
          throw Exception('UserId required for audio transcription');
        }
        AppLogger.debug('Uploading audio file to Supabase storage for AssemblyAI transcription', tag: 'AIGatewayService');
        tempStoragePath = await _supabase.uploadFile(userId, audioFile);
        AppLogger.debug('Audio uploaded to storage: $tempStoragePath', tag: 'AIGatewayService');
        storagePath = tempStoragePath;
      } else {
        AppLogger.debug('Using provided storage path: $storagePath', tag: 'AIGatewayService');
      }
      
      // Call Edge Function with storage path for AssemblyAI transcription
      final supabase = _supabase.client;
      final requestBody = <String, dynamic>{
        'storagePath': storagePath,
      };
      
      AppLogger.debug('Calling transcribe-audio Edge Function with AssemblyAI transcription', tag: 'AIGatewayService');
      
      // Edge Function polls for up to 15 minutes server-side
      // Set timeout to 20 minutes to allow for Edge Function processing
      final result = await supabase.functions.invoke(
        'transcribe-audio',
        body: requestBody,
      ).timeout(
        const Duration(minutes: 20),
        onTimeout: () {
          throw Exception('Transcription request timed out. The audio file may be very long. Please try again or use a shorter recording.');
        },
      );

      // Handle response data
      if (result.data != null) {
        final data = result.data as Map<String, dynamic>;
        
        // Check if response contains an error
        if (data.containsKey('error')) {
          var errorMsg = data['error'] as String? ?? 'Transcription failed';
          errorMsg = errorMsg.trim();
          if (errorMsg.isEmpty) {
            errorMsg = 'Transcription failed. Please try again later.';
          }
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
        
        // Clean up temporary storage file
        if (tempStoragePath != null) {
          try {
            await _supabase.client.storage.from('documents').remove([tempStoragePath]);
            AppLogger.debug('Deleted temporary audio file from storage: $tempStoragePath', tag: 'AIGatewayService');
          } catch (e) {
            AppLogger.warning('Failed to delete temporary audio file from storage', error: e, tag: 'AIGatewayService');
            // Non-critical error - file will be cleaned up later
          }
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
          var errorMsg = error['message'] as String? ?? 'Transcription failed';
          errorMsg = errorMsg.trim();
          if (errorMsg.isEmpty) {
            errorMsg = 'Transcription failed. Please try again later.';
          }
          throw Exception(errorMsg);
        }
        throw Exception('Transcription failed with status ${result.status}');
      }

      throw Exception('No transcription data received');
    } catch (e) {
      // Clean up temporary storage file in case of error
      if (tempStoragePath != null) {
        try {
          await _supabase.client.storage.from('documents').remove([tempStoragePath]);
          AppLogger.debug('Deleted temporary audio file from storage after error: $tempStoragePath', tag: 'AIGatewayService');
        } catch (cleanupError) {
          AppLogger.warning('Failed to delete temporary audio file from storage', error: cleanupError, tag: 'AIGatewayService');
          // Non-critical error
        }
      }
      
      if (e is RateLimitError) {
        rethrow;
      }
      
      final errorMessage = e.toString();
      AppLogger.error('Transcription error', error: e, tag: 'AIGatewayService');
      throw Exception('Failed to transcribe audio: ${errorMessage.contains("Exception:") ? errorMessage.split("Exception:")[1].trim() : errorMessage}');
    }
  }

  /// Generate intelligent summary (matches website's generateIntelligentSummary)
  /// For comprehensive mode, generates a detailed rewrite rather than a summary
  Future<String> generateSummary(String content, {List<Map<String, dynamic>>? documents, String detailLevel = 'standard', String? language, bool isRetry = false}) async {
    try {
      // Don't truncate - process all content to capture everything
      final balancedContent = content;
      
      // Calculate word count to determine optimal strategy
      final wordCount = balancedContent.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
      
      // Dynamic chunk sizing based on content length and detail level
      // Goal: Use largest possible chunks that fit in token limits while ensuring we capture everything
      // For very long content, use larger chunks to minimize API calls and maximize speed
      int chunkSize;
      if (wordCount < 2000) {
        // Short content: process in one chunk for maximum speed
        chunkSize = wordCount + 100; // Slightly larger to ensure we capture everything
      } else if (wordCount < 5000) {
        // Medium content: use 2-3 chunks
        chunkSize = (wordCount / 2.5).round(); // Split into ~2.5 chunks
      } else if (wordCount < 10000) {
        // Long content: use 3-4 chunks with larger size
        chunkSize = (wordCount / 3.5).round(); // Split into ~3.5 chunks
      } else {
        // Very long content: use 4-6 chunks with maximum size
        // Use larger chunks for comprehensive to capture more context per chunk
        chunkSize = detailLevel == 'comprehensive' 
            ? (wordCount / 4).round() // ~4 chunks for comprehensive
            : (wordCount / 5).round(); // ~5 chunks for standard/concise
        // Cap at reasonable maximum to avoid timeouts (4000 words per chunk is safe)
        chunkSize = chunkSize.clamp(2000, 4000);
      }
      
      // Split into chunks if content is long enough
      final chunks = wordCount > 1500 
          ? _splitIntoChunksByWords(balancedContent, chunkSize)
          : [balancedContent];
      
      if (chunks.length > 1) {
        // Generate partial summaries for each chunk IN PARALLEL for faster processing
        final systemPrompt = _generateSummarySystemPrompt(detailLevel, language: language);
        final chunkFutures = chunks.asMap().entries.map((entry) async {
          final i = entry.key;
          final chunk = entry.value;
          try {
            final partPrompt = _generateSummaryUserPrompt(
              chunk,
              documents: documents,
              detailLevel: detailLevel,
              partInfo: {'index': i + 1, 'total': chunks.length},
              language: language,
            );
            
            // Use gpt-4o-mini (fastest model) with lower temperature for faster, more focused responses
            final partRaw = await chatCompletion([
              {'role': 'system', 'content': systemPrompt},
              {'role': 'user', 'content': partPrompt},
            ], model: 'gpt-4o-mini', temperature: 0.2);
            
            return _sanitizeHtmlOutput(partRaw);
          } catch (e) {
            // If a chunk times out, log and return null (will be filtered out)
            if (e.toString().contains('timeout') || e.toString().contains('504')) {
              AppLogger.warning('Chunk ${i + 1} timed out, skipping', tag: 'AIGatewayService');
              return null;
            }
            rethrow;
          }
        }).toList();
        
        // Wait for all chunks to complete in parallel
        final chunkResults = await Future.wait(chunkFutures);
        final partialSummaries = chunkResults.whereType<String>().toList();
        
        if (partialSummaries.isEmpty) {
          throw Exception('All summary chunks timed out. The content may be too long. Please try with shorter content.');
        }
        
        // Merge partial summaries
        try {
          final mergePrompt = _generateSummaryMergePrompt(partialSummaries, detailLevel, language: language);
          // Lower temperature for merge step for faster, more focused merging
          final mergedRaw = await chatCompletion([
            {'role': 'system', 'content': _generateSummarySystemPrompt(detailLevel, language: language)},
            {'role': 'user', 'content': mergePrompt},
          ], model: 'gpt-4o-mini', temperature: 0.2);
          
          return _sanitizeHtmlOutput(mergedRaw);
        } catch (e) {
          // If merge times out, return the partial summaries joined together
          if (e.toString().contains('timeout') || e.toString().contains('504')) {
            AppLogger.warning('Merge timed out, returning partial summaries', tag: 'AIGatewayService');
            return partialSummaries.join('\n\n');
          }
          rethrow;
        }
      } else {
        // Single chunk - process directly (fastest path for short content)
        final userPrompt = _generateSummaryUserPrompt(
          balancedContent,
          documents: documents,
          detailLevel: detailLevel,
          language: language,
        );
        
        try {
          // Lower temperature for faster, more focused single-chunk summaries
          final raw = await chatCompletion([
            {'role': 'system', 'content': _generateSummarySystemPrompt(detailLevel, language: language)},
            {'role': 'user', 'content': userPrompt},
          ], model: 'gpt-4o-mini', temperature: 0.2);
          
          return _sanitizeHtmlOutput(raw);
        } catch (e) {
          // If single chunk times out, it means content is too long - should have been chunked
          // Fallback: retry with proper chunking (but only once to avoid infinite recursion)
          if ((e.toString().contains('timeout') || e.toString().contains('504')) && !isRetry) {
            AppLogger.warning('Single chunk timed out, retrying with dynamic chunking', tag: 'AIGatewayService');
            // Re-process with proper dynamic chunking
            return await generateSummary(
              balancedContent,
              documents: documents,
              detailLevel: detailLevel,
              language: language,
              isRetry: true,
            );
          }
          rethrow;
        }
      }
    } catch (e) {
      if (e is RateLimitError) rethrow;
      AppLogger.error('Error generating summary', error: e, tag: 'AIGatewayService');
      throw Exception('Failed to generate summary: $e');
    }
  }

  /// Edit an existing summary based on user instructions
  /// Examples: "Add analogy for x", "Rewrite the section about y", "Remove the part about z"
  Future<String> editSummary(String currentSummary, String userInstruction, {String? originalContent}) async {
    try {
      final messages = [
        {
          'role': 'system',
          'content': '''You are an expert educational content editor. Your task is to modify an existing summary based on user instructions while maintaining the overall structure and quality of the summary.

CRITICAL REQUIREMENTS:
- Preserve the HTML formatting and structure of the original summary
- Only make the specific changes requested by the user
- Maintain consistency in style, tone, and formatting
- Keep all other content unchanged unless explicitly requested
- Use proper HTML tags (p, h2, h3, h4, ul, ol, li, strong, em, blockquote, mark, etc.)
- For mathematical content, use LaTeX: inline equations with \$...\$ and block equations with \$\$...\$\$

When adding content:
- Integrate new content naturally into the existing structure
- Match the writing style and tone of the original summary
- Use appropriate HTML formatting

When rewriting:
- Keep the same level of detail and explanation
- Maintain the same structure unless requested otherwise
- Preserve important information that isn't being rewritten

When removing:
- Remove only the specified content
- Ensure the remaining text flows naturally
- Fix any broken references or incomplete sentences

Return ONLY the modified HTML summary, no explanations or additional text.''',
        },
        {
          'role': 'user',
          'content': '''Current Summary:
$currentSummary

${originalContent != null ? 'Original Note Content (for context):\n${_truncateContent(originalContent, 2000)}\n\n' : ''}User Instruction: $userInstruction

Please modify the summary according to the instruction above. Return the complete modified summary in HTML format.''',
        },
      ];

      final response = await chatCompletion(
        messages,
        model: 'gpt-4o-mini',
        temperature: 0.7,
      );

      return _sanitizeHtmlOutput(response);
    } catch (e) {
      if (e is RateLimitError) rethrow;
      AppLogger.error('Error editing summary', error: e, tag: 'AIGatewayService');
      throw Exception('Failed to edit summary: $e');
    }
  }

  String _generateSummarySystemPrompt(String detailLevel, {String? language}) {
    final isComprehensive = detailLevel == 'comprehensive';
    final languageInstruction = language != null && language != 'en' 
        ? '\n\nIMPORTANT: The content is in ${_getLanguageName(language)}. You MUST generate your response in the SAME language (${_getLanguageName(language)}). Do NOT translate to English - keep the same language as the input.'
        : '';
    
    if (isComprehensive) {
      return '''You are an expert educational content writer. Your task is to REWRITE and RESTRUCTURE the provided content in a more organized, detailed, and comprehensive way. This is NOT a summary - you should cover EVERYTHING from the original content, but present it better structured and explained.$languageInstruction

CRITICAL REQUIREMENTS FOR CONTENT ACCURACY:
1. Summarize EVERYTHING the user said - do NOT pick just one topic and write about it
2. Cover ALL topics, points, and concepts mentioned in the source material
3. If the recording is very short, make the rewrite proportionally shorter - do NOT expand or make up content
4. ONLY include information that is actually present in the source material - do NOT invent or hallucinate content
5. For short recordings, focus on accurately capturing what was said without adding unnecessary detail
6. If multiple topics are mentioned, cover ALL of them, not just one

CRITICAL REQUIREMENTS:
- DO NOT summarize - instead, rewrite and expand on ALL content from the original
- Cover EVERY concept, topic, detail, example, and explanation from the original material
- The length should scale with the original content: if the original has 30 slides, your output should be approximately 3 times longer than if it had 10 slides
- Restructure the content with better organization and clearer explanations
- Use proper HTML tags (p, h2, h3, h4, ul, ol, li, strong, em, blockquote, mark, etc.)

STRUCTURE REQUIREMENTS:
- Use headings (h2, h3, h4) to organize content into clear sections and subsections
- For EVERY major concept or term, include a definition block using <blockquote> tags
- Format definitions like this: <blockquote><strong>Term:</strong> Detailed definition and explanation</blockquote>
- Include ALL mathematical equations from the original content
- Format equations using LaTeX: inline equations with \$...\$ and block equations with \$\$...\$\$
- Preserve and expand on ALL examples, explanations, and context

CONTENT REQUIREMENTS:
- Include ALL key concepts, main points, and important details
- Explain concepts thoroughly so users can fully understand without the original
- Include examples, explanations, and context where relevant
- Cover all topics, themes, and subtopics mentioned
- Provide detailed explanations, not just brief mentions
- Include relationships between concepts
- Explain terminology and technical terms in detail
- Cover all documents and their contents comprehensively
- Use <strong> tags for bold emphasis on important terms (these will appear in amber/yellow)
- Use <mark> tags to highlight and emphasize key points (these will appear with blue background matching the summary button)
- IMPORTANT: Use <mark> tags for highlighting, NOT <strong> tags. <mark> tags create blue highlighted text.

LENGTH REQUIREMENTS:
- The output should be significantly longer than a typical summary
- Scale the length based on the original content size
- Aim for comprehensive coverage - completeness is more important than brevity
- Include enough detail that the user can learn from your rewrite alone

Return ONLY valid HTML, no markdown or code fences.''';
    }
    
    return '''You are an expert educational content summarizer. Create a ${detailLevel == 'concise' ? 'brief and focused' : 'balanced and informative'} summary in HTML format.$languageInstruction

CRITICAL REQUIREMENTS FOR CONTENT ACCURACY:
1. Summarize EVERYTHING the user said - do NOT pick just one topic and write about it
2. Cover ALL topics, points, and concepts mentioned in the source material
3. If the recording is very short, make the summary proportionally shorter - do NOT expand or make up content
4. ONLY include information that is actually present in the source material - do NOT invent or hallucinate content
5. For short recordings, focus on accurately capturing what was said without adding unnecessary detail
6. If multiple topics are mentioned, cover ALL of them, not just one

Requirements:
- Use proper HTML tags (p, h2, h3, h4, ul, ol, li, strong, em, blockquote, mark, etc.)
- Structure the summary with clear sections and subsections
- Include key concepts, main points, and important details
- Use headings (h2, h3, h4) to organize content logically with clear hierarchy
- Use <strong> tags for bold emphasis on important terms (these will appear in amber/yellow)
- Use <mark> tags to highlight and emphasize key points (these will appear with blue background matching the summary button)
- IMPORTANT: Use <mark> tags for highlighting, NOT <strong> tags. <mark> tags create blue highlighted text.
- Be informative and clear
- Return ONLY valid HTML, no markdown or code fences''';
  }

  String _generateSummaryUserPrompt(
    String content, {
    List<Map<String, dynamic>>? documents,
    String detailLevel = 'standard',
    Map<String, dynamic>? partInfo,
    String? language,
  }) {
    final docInfo = documents != null && documents.isNotEmpty
        ? 'Documents: ${documents.take(6).map((d) => '${d['name']} [${d['type']}]').join(', ')}'
        : 'No additional documents';
    
    final partText = partInfo != null
        ? '\n\nThis is part ${partInfo['index']} of ${partInfo['total']} parts. Focus on this section while maintaining context.'
        : '';
    
    // Calculate word target based on content length
    // Count actual words for more accurate estimation
    final wordCount = content.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
    final isShortRecording = wordCount < 300;
    
    // Calculate estimated slides for comprehensive mode instructions
    final estimatedSlides = (wordCount / 500).ceil();
    final lengthMultiplier = (estimatedSlides / 10.0).clamp(0.1, 5.0); // Cap multiplier
    
    // Calculate word target with special handling for very short recordings
    int minWords;
    int maxWords;
    String wordTarget;
    
    if (wordCount < 100) {
      // Very short recordings (e.g., 10-50 words) should get very short summaries
      minWords = (wordCount * 0.8).round().clamp(50, 200);
      maxWords = (wordCount * 1.5).round().clamp(100, 300);
      wordTarget = '$minWords-$maxWords';
    } else if (wordCount < 300) {
      // Short recordings (e.g., 100-300 words) should get proportionally shorter summaries
      minWords = (wordCount * 0.4).round().clamp(100, 400);
      maxWords = (wordCount * 0.7).round().clamp(200, 600);
      wordTarget = '$minWords-$maxWords';
    } else {
      // Longer content - use slide-based estimation
      // Base word count: 2000-4000 words for 10 slides
      final baseMinWords = 2000;
      final baseMaxWords = 4000;
      minWords = (baseMinWords * lengthMultiplier).round();
      maxWords = (baseMaxWords * lengthMultiplier).round();
      
      // Ensure minimum word count for medium-length content
      if (wordCount < 800) {
        minWords = (minWords * 0.5).round().clamp(200, 1000);
        maxWords = (maxWords * 0.6).round().clamp(400, 1500);
      }
      
      wordTarget = '$minWords-$maxWords';
    }
    
    final comprehensiveInstructions = detailLevel == 'comprehensive' ? '''

CRITICAL INSTRUCTIONS - THIS IS A REWRITE, NOT A SUMMARY:
- DO NOT summarize - instead, REWRITE and RESTRUCTURE the entire content
- Cover EVERY aspect of the content in detail - nothing should be left out
- The original content appears to have approximately $estimatedSlides slides worth of material
- Your output should be approximately ${(lengthMultiplier * 100).toStringAsFixed(0)}% of the base length to properly scale with content size
- Explain concepts thoroughly so the user can fully understand without referring to the original
- Include ALL key points, details, examples, and explanations from the content
- Cover all topics, subtopics, and themes comprehensively
- Provide detailed explanations for technical terms and concepts
- Include context and relationships between different ideas
- Make sure the rewrite is detailed enough that the user can learn from it independently
- Organize content into clear sections covering all major topics
- Be thorough and complete - prioritize comprehensiveness over brevity

REQUIRED ELEMENTS:
- Include definition blocks for ALL major terms and concepts using <blockquote> tags
- Format: <blockquote><strong>Term Name:</strong> Detailed definition and explanation</blockquote>
- Include ALL mathematical equations from the original using LaTeX format
- Use \$...\$ for inline equations and \$\$...\$\$ for block equations
- Preserve and expand on ALL examples, case studies, and illustrations
- Include ALL important formulas, theorems, and proofs mentioned
- Use <mark> tags to highlight key terms and important concepts (blue highlighting matching the summary button)
- Use <strong> tags only for bold text, NOT for highlighting (strong tags appear in amber/yellow)

STRUCTURE:
- Use clear hierarchical headings (h2 for main topics, h3 for subtopics, h4 for sub-subtopics)
- Group related concepts together logically
- Provide smooth transitions between sections
- Make the organization better than the original while covering everything''' : '';
    
    final shortRecordingNote = isShortRecording 
        ? '\n\nCRITICAL: This is a short recording (${wordCount} words). Summarize EVERYTHING mentioned - cover ALL topics, points, and concepts. Do NOT focus on just one topic. Keep the summary brief and proportional - do NOT expand beyond what was actually said. Aim for the lower end of the word range.'
        : '\n\nCRITICAL: Summarize EVERYTHING mentioned in the source material. Cover ALL topics, points, and concepts - do NOT focus on just one topic. If multiple things are discussed, include ALL of them.';
    
    return '''${detailLevel == 'comprehensive' ? 'REWRITE and RESTRUCTURE' : 'Create a ${detailLevel} summary of'} the following content in HTML format.$comprehensiveInstructions$shortRecordingNote

Content:
$content

$docInfo$partText

Target length: $wordTarget words${wordCount >= 300 ? ' (scaled based on content length: approximately $estimatedSlides slides)' : ''}.${isShortRecording ? ' For short recordings, aim for the lower end of this range.' : ' Aim for the higher end of the word range to ensure comprehensive coverage.'}
Return ONLY valid HTML content, no markdown or code fences.''';
  }

  String _generateSummaryMergePrompt(List<String> partialSummaries, String detailLevel, {String? language}) {
    // Calculate target length based solely on combined content length (not detail level)
    // Estimate original content length from partial summaries (they're typically 30-50% of original)
    final totalLength = partialSummaries.fold<int>(0, (sum, part) => sum + part.length);
    // Estimate original content was ~2-3x longer than summaries
    final estimatedOriginalLength = totalLength * 2.5;
    final estimatedWords = estimatedOriginalLength / 5;
    final estimatedSlides = (estimatedWords / 500).ceil();
    final lengthMultiplier = estimatedSlides / 10.0; // Base is 10 slides
    
    // Base word count: 2000-4000 words for 10 slides
    // Scales proportionally: 30 slides = 3x = 6000-12000 words
    final baseMinWords = 2000;
    final baseMaxWords = 4000;
    final minWords = (baseMinWords * lengthMultiplier).round();
    final maxWords = (baseMaxWords * lengthMultiplier).round();
    
    // Ensure minimum word count even for very short content
    final wordTarget = '${minWords < 500 ? 500 : minWords}-${maxWords < 1000 ? 1000 : maxWords}';
    final isComprehensive = detailLevel == 'comprehensive';
    final languageInstruction = language != null && language != 'en' 
        ? '\n\nIMPORTANT: Generate your response in ${_getLanguageName(language)}. Keep the same language as the partial summaries.'
        : '';
    
    return '''Merge the following partial ${isComprehensive ? 'rewrites' : 'summaries'} into a single, coherent, ${isComprehensive ? 'highly detailed and comprehensive rewrite' : 'comprehensive summary'} in HTML format.$languageInstruction

Partial ${isComprehensive ? 'Rewrites' : 'Summaries'}:
${partialSummaries.asMap().entries.map((e) => 'Part ${e.key + 1}:\n${e.value}').join('\n\n')}

Requirements:
- Combine all parts into a unified ${isComprehensive ? 'rewrite' : 'summary'}
- ${isComprehensive ? 'Preserve ALL details from all parts - do not omit information. This is a comprehensive rewrite, not a summary.' : 'Remove redundancy and overlap while preserving important details'}
- Maintain logical flow and structure with clear sections
- Use proper HTML formatting (h2, h3, h4, p, ul, ol, li, strong, em, blockquote, mark)
- Use <strong> tags for bold emphasis on important terms (these will appear in amber/yellow)
- Use <mark> tags to highlight and emphasize key points (these will appear with blue background matching the summary button)
- IMPORTANT: Use <mark> tags for highlighting, NOT <strong> tags. <mark> tags create blue highlighted text.
- ${isComprehensive ? 'Ensure comprehensive coverage - include all topics, concepts, details, definitions, and equations from all parts' : 'Maintain key information from all parts'}
- ${isComprehensive ? 'Ensure ALL definition blocks and mathematical equations from all parts are included' : ''}
- Target length: $wordTarget words (scaled based on content length, aim for higher end to ensure completeness)
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
      AppLogger.warning('Error generating title', error: e, tag: 'AIGatewayService');
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

      // Add timeout to prevent hanging (Edge Functions typically timeout at 60-300s)
      // Increased timeout to 180 seconds (3 minutes) to allow for longer summaries
      // This gives enough time for comprehensive summaries with large content
      final result = await supabase.functions.invoke(
        'ai-generate',
        body: {
          'type': 'chat',
          'messages': messages,
          'model': model,
          'temperature': temperature,
        },
      ).timeout(
        const Duration(seconds: 180), // 3 minutes - enough time for comprehensive summaries
        onTimeout: () {
          throw Exception('Request timed out. The content may be too long. Please try with shorter content or try again later.');
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
      
      // Check for timeout errors
      final errorStr = e.toString();
      if (errorStr.contains('timeout') || errorStr.contains('504') || errorStr.contains('Gateway Timeout')) {
        AppLogger.warning('Chat completion timed out - content may be too long', tag: 'AIGatewayService');
        throw Exception('Request timed out. The content may be too long. Please try with shorter content or try again later.');
      }
      
      // Check if it's a Supabase FunctionException
      if (errorStr.contains('FunctionException')) {
        // Check for 504 Gateway Timeout
        if (errorStr.contains('504') || errorStr.contains('Gateway Timeout')) {
          AppLogger.warning('Edge Function timed out (504)', tag: 'AIGatewayService');
          throw Exception('Request timed out. The content may be too long. Please try with shorter content or try again later.');
        }
        
        // Try to parse the error details
        if (errorStr.contains('DAILY_LIMIT_REACHED') || errorStr.contains('ACCOUNT_LIMIT_REACHED')) {
          throw RateLimitError(
            code: errorStr.contains('ACCOUNT_LIMIT_REACHED') ? 'ACCOUNT_LIMIT_REACHED' : 'DAILY_LIMIT_REACHED',
            message: 'Rate limit reached',
          );
        }
      }
      
      final errorMessage = e.toString();
      AppLogger.error('Chat completion error', error: errorMessage, tag: 'AIGatewayService');
      throw Exception('Failed to complete chat: $errorMessage');
    }
  }

  /// Generate flashcards using chat completion (matches website's generateFlashcards)
  Future<List<Map<String, dynamic>>> generateFlashcards(String content, {int count = 20, String? language}) async {
    try {
      final languageInstruction = language != null && language != 'en' 
          ? '\n\nIMPORTANT: The content is in ${_getLanguageName(language)}. You MUST generate the flashcards in the SAME language (${_getLanguageName(language)}). Do NOT translate to English - keep the same language as the input.'
          : '';
      
      final messages = [
        {
          'role': 'system',
          'content': 'You are a helpful assistant that creates educational flashcards. Return a JSON array of flashcards with "front", "back", and "hint" properties.$languageInstruction',
        },
        {
          'role': 'user',
          'content': 'Create EXACTLY $count flashcards from the following text content. The text below is the actual content extracted from documents - you do NOT need to access any files. Use this text directly to create flashcards.$languageInstruction\n\nRequirements:\n1. Give EQUAL coverage to all sections; do not focus only on early sections\n2. Progress difficulty (definitions/facts → concepts/relationships → applications)\n3. Ensure breadth across distinct topics; avoid redundancy\n4. If the same fact appears multiple times, MERGE that into one clear card (do not duplicate) and prefer the clearest wording\n5. For each flashcard, include a "hint" property that provides a subtle tip to help the user recall the answer without giving it away. The hint should guide thinking but not spoil the answer.\n\nText Content:\n${_truncateContent(content, 1500)}\n\nReturn exactly $count flashcards as a JSON array with "front", "back", and "hint" properties.',
        },
      ];

      final response = await chatCompletion(messages, model: 'gpt-4o-mini', temperature: 0.7);
      
      // Check if response looks like an error message
      if (_isErrorMessage(response)) {
        throw Exception('AI service returned an error: $response');
      }
      
      final jsonContent = _extractJSON(response);
      
      // Validate that we have valid JSON before parsing
      if (!_isValidJSON(jsonContent)) {
        AppLogger.error('Invalid JSON response from AI service', error: jsonContent, tag: 'AIGatewayService');
        throw Exception('AI service returned invalid JSON. Response: ${jsonContent.length > 200 ? jsonContent.substring(0, 200) + "..." : jsonContent}');
      }
      
      final flashcards = jsonDecode(jsonContent) as List;
      
      return flashcards.cast<Map<String, dynamic>>().take(count).toList();
    } catch (e) {
      if (e is RateLimitError) rethrow;
      AppLogger.error('Error generating flashcards', error: e, tag: 'AIGatewayService');
      throw Exception('Failed to generate flashcards: $e');
    }
  }

  /// Generate quiz questions using chat completion (matches website's generateQuiz)
  Future<List<Map<String, dynamic>>> generateQuiz(String content, {int count = 15, String? language}) async {
    try {
      final languageInstruction = language != null && language != 'en' 
          ? '\n\nIMPORTANT: The content is in ${_getLanguageName(language)}. You MUST generate the quiz questions in the SAME language (${_getLanguageName(language)}). Do NOT translate to English - keep the same language as the input.'
          : '';
      
      final messages = [
        {
          'role': 'system',
          'content': 'You are a helpful assistant that creates quiz questions. Return a JSON array of questions with "question", "options" (array of 4 strings), "correctAnswer" (index 0-3), "hint", and "explanation" properties.$languageInstruction',
        },
        {
          'role': 'user',
          'content': 'Create EXACTLY $count quiz questions from the following text content. The text below is the actual content extracted from documents - you do NOT need to access any files. Use this text directly to create quiz questions.$languageInstruction\n\nRequirements:\n1. Give EQUAL coverage to all sections; do not bias earlier sections\n2. Mix difficulty (recall → application → analysis) and cover different topics\n3. Make distractors plausible but clearly wrong\n4. If the same fact appears multiple times, combine knowledge and avoid duplicate questions\n5. For each question, include a "hint" property that provides a subtle tip to help the user think about the answer without giving it away. The hint should guide thinking but not spoil the answer.\n6. For each question, include an "explanation" property that is SHORT and concise (2-3 sentences max). It should: (a) briefly explain why the correct answer is correct, and (b) briefly explain why the other options are incorrect. Be direct and educational. Do NOT simply state what the correct answer is (e.g., "The correct answer is A").\n\nText Content:\n${_truncateContent(content, 1500)}\n\nReturn exactly $count quiz questions as a JSON array with "question", "options" (array of 4 strings), "correctAnswer" (index 0-3), "hint", and "explanation" properties.',
        },
      ];

      final response = await chatCompletion(messages, model: 'gpt-4o-mini', temperature: 0.7);
      
      // Check if response looks like an error message
      if (_isErrorMessage(response)) {
        throw Exception('AI service returned an error: $response');
      }
      
      final jsonContent = _extractJSON(response);
      
      // Validate that we have valid JSON before parsing
      if (!_isValidJSON(jsonContent)) {
        AppLogger.error('Invalid JSON response from AI service', error: jsonContent, tag: 'AIGatewayService');
        throw Exception('AI service returned invalid JSON. Response: ${jsonContent.length > 200 ? jsonContent.substring(0, 200) + "..." : jsonContent}');
      }
      
      final questions = jsonDecode(jsonContent) as List;
      
      return questions.cast<Map<String, dynamic>>().take(count).toList();
    } catch (e) {
      if (e is RateLimitError) rethrow;
      AppLogger.error('Error generating quiz', error: e, tag: 'AIGatewayService');
      throw Exception('Failed to generate quiz: $e');
    }
  }

  /// Generate exercises using chat completion (matches website's generateExercise)
  Future<List<Map<String, dynamic>>> generateExercises(String content, {int count = 10, String? language}) async {
    try {
      final languageInstruction = language != null && language != 'en' 
          ? '\n\nIMPORTANT: The content is in ${_getLanguageName(language)}. You MUST generate the exercises in the SAME language (${_getLanguageName(language)}). Do NOT translate to English - keep the same language as the input.'
          : '';
      
      final messages = [
        {
          'role': 'system',
          'content': 'You are a helpful assistant that creates practice exercises. Return a JSON array of exercises with "question", "solution", "notes", and "hint" properties.$languageInstruction',
        },
        {
          'role': 'user',
          'content': 'Create EXACTLY $count practice exercises from the following text content. The text below is the actual content extracted from documents - you do NOT need to access any files. Use this text directly to create exercises.$languageInstruction\n\nMake sure to:\n1. Cover ALL important concepts and key topics from the text comprehensively\n2. Create exercises in progressive difficulty (start with simpler applications, then more complex ones)\n3. Include a variety of exercise types:\n   - Problem-solving exercises\n   - Application of concepts\n   - Analysis and critical thinking\n   - Synthesis tasks\n4. Each exercise should have a clear, detailed solution\n5. Include helpful notes with tips or common pitfalls\n6. Ensure comprehensive coverage across different themes and topics\n7. For each exercise, include a "hint" property that provides a subtle tip to help the user approach the problem without giving away the solution. The hint should guide thinking but not spoil the answer.\n\nText Content:\n${_truncateContent(content, 2000)}\n\nReturn exactly $count exercises as a JSON array with "question", "solution", "notes", and "hint" properties.',
        },
      ];

      final response = await chatCompletion(messages, model: 'gpt-4o-mini', temperature: 0.7);
      
      // Check if response looks like an error message
      if (_isErrorMessage(response)) {
        throw Exception('AI service returned an error: $response');
      }
      
      final jsonContent = _extractJSON(response);
      
      // Validate that we have valid JSON before parsing
      if (!_isValidJSON(jsonContent)) {
        AppLogger.error('Invalid JSON response from AI service', error: jsonContent, tag: 'AIGatewayService');
        throw Exception('AI service returned invalid JSON. Response: ${jsonContent.length > 200 ? jsonContent.substring(0, 200) + "..." : jsonContent}');
      }
      
      final exercises = jsonDecode(jsonContent) as List;
      
      return exercises.cast<Map<String, dynamic>>().take(count).toList();
    } catch (e) {
      if (e is RateLimitError) rethrow;
      AppLogger.error('Error generating exercises', error: e, tag: 'AIGatewayService');
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
      
      AppLogger.info('Processing web link: $url', tag: 'AIGatewayService');
      
      // Detect link type
      final linkType = detectLinkType(url);
      
      // Reject YouTube links
      if (linkType == 'youtube') {
        throw Exception('YouTube videos are not supported. Please use a different link.');
      }
      
      AppLogger.debug('Detected link type: $linkType', tag: 'AIGatewayService');
      
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
        
        AppLogger.success('Link processed successfully. Title: $title, Content length: ${content.length}', tag: 'AIGatewayService');
        
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
      AppLogger.error('Error processing web link', error: e, tag: 'AIGatewayService');
      rethrow;
    }
  }

  /// Generate Feynman topics using chat completion (matches website's generateFeynmanTopicsHelper)
  Future<List<Map<String, dynamic>>> generateFeynmanTopics(String content, {String? language, int count = 4}) async {
    try {
      final languageInstruction = language != null && language != 'en' 
          ? '\n\nIMPORTANT: The content is in ${_getLanguageName(language)}. You MUST generate the topics in the SAME language (${_getLanguageName(language)}). Do NOT translate to English - keep the same language as the input.'
          : '';
      
      final messages = [
        {
          'role': 'system',
          'content': 'You are an educational assistant helping create practice topics.$languageInstruction',
        },
        {
          'role': 'user',
          'content': 'Based on this note content, generate exactly $count specific topics that a student could practice explaining using the Feynman Technique. Focus on the main concepts, terms, or ideas that would be good for teaching.$languageInstruction\n\nNote content:\n${_truncateContent(content, 1000)}\n\nReturn a JSON array of objects with "title" (short topic title starting with "Explain:") and "description" (brief description). Keep titles concise (max 50 chars). Generate exactly $count topics.',
        },
      ];

      final response = await chatCompletion(messages, model: 'gpt-4o-mini', temperature: 0.7);
      
      // Check if response looks like an error message
      if (_isErrorMessage(response)) {
        AppLogger.warning('AI service returned an error for Feynman topics', error: response, tag: 'AIGatewayService');
        return [];
      }
      
      final jsonContent = _extractJSON(response);
      
      // Validate that we have valid JSON before parsing
      if (!_isValidJSON(jsonContent)) {
        AppLogger.error('Invalid JSON response from AI service for Feynman topics', error: jsonContent, tag: 'AIGatewayService');
        return [];
      }
      
      final topics = jsonDecode(jsonContent) as List;
      return topics.asMap().entries.take(count).map((entry) {
        final topic = entry.value as Map<String, dynamic>;
        return {
          'id': (entry.key + 1).toString(),
          'title': topic['title'] ?? 'Topic ${entry.key + 1}',
          'description': topic['description'] ?? '',
        };
      }).toList();
    } catch (e) {
      if (e is RateLimitError) rethrow;
      AppLogger.error('Error generating feynman topics', error: e, tag: 'AIGatewayService');
      return [];
    }
  }

  /// Check if response looks like an error message instead of JSON
  bool _isErrorMessage(String response) {
    final lowerResponse = response.toLowerCase().trim();
    // Check for common error message patterns
    return lowerResponse.startsWith('since i am unable') ||
        lowerResponse.startsWith('i am unable') ||
        lowerResponse.startsWith('i cannot') ||
        lowerResponse.startsWith('unable to') ||
        lowerResponse.contains('error') && !lowerResponse.contains('[') && !lowerResponse.contains('{') ||
        (lowerResponse.contains('sorry') && lowerResponse.contains('cannot')) ||
        (lowerResponse.contains('unable') && lowerResponse.contains('access'));
  }

  /// Validate that a string is valid JSON before parsing
  bool _isValidJSON(String jsonString) {
    if (jsonString.trim().isEmpty) {
      return false;
    }
    
    try {
      jsonDecode(jsonString);
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Extract JSON from AI response (matches website's extractJSON)
  /// Handles responses with markdown code blocks and explanatory text
  String _extractJSON(String response) {
    // Try to find JSON in markdown code blocks first (most reliable)
    final codeBlockMatch = RegExp(r'```(?:json)?\s*([\s\S]*?)```').firstMatch(response);
    if (codeBlockMatch != null) {
      final extracted = codeBlockMatch.group(1)!.trim();
      // Validate it's actually JSON before returning
      if (_isValidJSON(extracted)) {
        return extracted;
      }
    }
    
    // Try to find JSON array by finding the first '[' and matching brackets
    // This handles nested structures better than regex
    final arrayStart = response.indexOf('[');
    if (arrayStart != -1) {
      final extracted = _extractBalancedBrackets(response, arrayStart, '[', ']');
      if (extracted != null && _isValidJSON(extracted)) {
        return extracted;
      }
    }
    
    // Try to find JSON object by finding the first '{' and matching braces
    final objectStart = response.indexOf('{');
    if (objectStart != -1) {
      final extracted = _extractBalancedBrackets(response, objectStart, '{', '}');
      if (extracted != null && _isValidJSON(extracted)) {
        return extracted;
      }
    }
    
    // If no match, try the whole response (might be pure JSON)
    final trimmed = response.trim();
    if (_isValidJSON(trimmed)) {
      return trimmed;
    }
    
    // Return trimmed response as fallback (will be caught by validation)
    return trimmed;
  }

  /// Extract balanced brackets/braces from a string starting at a given position
  /// Returns null if brackets are not balanced
  String? _extractBalancedBrackets(String text, int start, String open, String close) {
    if (start < 0 || start >= text.length) return null;
    
    int depth = 0;
    int end = start;
    bool inString = false;
    bool escapeNext = false;
    
    for (int i = start; i < text.length; i++) {
      final char = text[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char == '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char == '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char == open) {
        depth++;
      } else if (char == close) {
        depth--;
        if (depth == 0) {
          end = i + 1;
          break;
        }
      }
    }
    
    if (depth == 0 && end > start) {
      return text.substring(start, end);
    }
    
    return null;
  }

  /// Truncate content to avoid rate limits (matches website's truncateContent)
  /// For comprehensive summaries, this is not used - all content is processed
  String _truncateContent(String content, [int maxLength = 2000]) {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  /// Get language name from ISO code
  String _getLanguageName(String code) {
    const names = {
      'en': 'English',
      'de': 'German',
      'fr': 'French',
      'es': 'Spanish',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
    };
    return names[code] ?? 'English';
  }

  /// Detect language from text content using AI
  /// Returns ISO 639-1 language code (e.g., 'en', 'de', 'fr')
  Future<String> detectLanguage(String text) async {
    try {
      if (text.trim().isEmpty) return 'en';
      
      // Take a sample of the text (first 1000 characters should be enough)
      final sample = text.length > 1000 ? text.substring(0, 1000) : text;
      
      final messages = [
        {
          'role': 'system',
          'content': 'You are a language detection assistant. Analyze the provided text and return ONLY the ISO 639-1 language code (e.g., "en" for English, "de" for German, "fr" for French, "es" for Spanish, "it" for Italian, "pt" for Portuguese, "nl" for Dutch, "ru" for Russian, "zh" for Chinese, "ja" for Japanese, "ko" for Korean). Return only the two-letter code, nothing else.',
        },
        {
          'role': 'user',
          'content': 'What language is this text written in? Return only the ISO 639-1 language code.\n\nText:\n$sample',
        },
      ];

      final response = await chatCompletion(messages, model: 'gpt-4o-mini', temperature: 0.1);
      
      // Extract language code from response (should be just 2 letters)
      final languageCode = response.trim().toLowerCase();
      
      // Validate it's a valid 2-letter code
      if (languageCode.length == 2 && RegExp(r'^[a-z]{2}$').hasMatch(languageCode)) {
        return languageCode;
      }
      
      // Fallback to English if detection fails
      AppLogger.warning('AI language detection returned invalid code: $languageCode, defaulting to English', tag: 'AIGatewayService');
      return 'en';
    } catch (e) {
      AppLogger.error('Error detecting language with AI', error: e, tag: 'AIGatewayService');
      // Fallback to English on error
      return 'en';
    }
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

