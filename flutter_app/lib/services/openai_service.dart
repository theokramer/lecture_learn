import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/study_content.dart';

class OpenAIService {
  static final OpenAIService _instance = OpenAIService._internal();
  factory OpenAIService() => _instance;
  OpenAIService._internal();

  String? _apiKey;
  static const String _baseUrl = 'https://api.openai.com/v1';

  void initialize(String apiKey) {
    _apiKey = apiKey;
  }

  Future<String> transcribeAudio(File audioFile, {String? storagePath}) async {
    if (_apiKey == null) throw Exception('OpenAI API key not initialized');

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$_baseUrl/audio/transcriptions'),
    );

    request.headers['Authorization'] = 'Bearer $_apiKey';
    request.fields['model'] = 'whisper-1';
    request.files.add(
      await http.MultipartFile.fromPath('file', audioFile.path),
    );

    final response = await request.send();
    final responseBody = await response.stream.bytesToString();

    if (response.statusCode != 200) {
      throw Exception('Transcription failed: $responseBody');
    }

    final json = jsonDecode(responseBody) as Map<String, dynamic>;
    return json['text'] as String;
  }

  Future<String> chatCompletions(List<Map<String, String>> messages, {String? context}) async {
    if (_apiKey == null) throw Exception('OpenAI API key not initialized');

    final systemMessage = context != null
        ? {
            'role': 'system',
            'content': 'You are a helpful educational assistant. Use the following context to answer questions: $context',
          }
        : {
            'role': 'system',
            'content': 'You are a helpful educational assistant.',
          };

    final allMessages = [systemMessage, ...messages];

    final response = await http.post(
      Uri.parse('$_baseUrl/chat/completions'),
      headers: {
        'Authorization': 'Bearer $_apiKey',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'model': 'gpt-4o-mini',
        'messages': allMessages,
        'temperature': 0.7,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Chat completion failed: ${response.body}');
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return json['choices'][0]['message']['content'] as String;
  }

  Future<String> generateTitle(String content) async {
    final prompt = 'Generate a concise, descriptive title (max 60 characters) for the following content:\n\n$content';
    final response = await chatCompletions([
      {'role': 'user', 'content': prompt}
    ]);
    return response.trim().replaceAll('"', '');
  }

  Future<List<Flashcard>> generateFlashcards(String content) async {
    final prompt = '''Based on the following content, generate 10-15 flashcards. Return ONLY a valid JSON array of objects with "front" and "back" properties.

Content:
$content

Return format: [{"front": "question", "back": "answer"}, ...]''';

    final response = await chatCompletions([
      {'role': 'user', 'content': prompt}
    ]);

    try {
      final jsonMatch = RegExp(r'\[[\s\S]*\]').firstMatch(response);
      if (jsonMatch != null) {
        final json = jsonDecode(jsonMatch.group(0)!) as List;
        return json.asMap().entries.map((e) {
          final item = e.value as Map<String, dynamic>;
          return Flashcard(
            id: 'gen-${DateTime.now().millisecondsSinceEpoch}-${e.key}',
            front: item['front'] as String,
            back: item['back'] as String,
          );
        }).toList();
      }
    } catch (e) {
      print('Error parsing flashcards: $e');
    }
    return [];
  }

  Future<List<QuizQuestion>> generateQuiz(String content) async {
    final prompt = '''Based on the following content, generate 10 multiple-choice quiz questions. Return ONLY a valid JSON array of objects with "question", "options" (array), and "correctAnswer" (0-based index) properties.

Content:
$content

Return format: [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0}, ...]''';

    final response = await chatCompletions([
      {'role': 'user', 'content': prompt}
    ]);

    try {
      final jsonMatch = RegExp(r'\[[\s\S]*\]').firstMatch(response);
      if (jsonMatch != null) {
        final json = jsonDecode(jsonMatch.group(0)!) as List;
        return json.asMap().entries.map((e) {
          final item = e.value as Map<String, dynamic>;
          return QuizQuestion(
            id: 'gen-${DateTime.now().millisecondsSinceEpoch}-${e.key}',
            question: item['question'] as String,
            options: (item['options'] as List).cast<String>(),
            correctAnswer: item['correctAnswer'] as int,
          );
        }).toList();
      }
    } catch (e) {
      print('Error parsing quiz: $e');
    }
    return [];
  }
}

