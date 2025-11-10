import '../utils/logger.dart';

enum StudyMode {
  summary,
  feynman,
  flashcards,
  quiz,
  exercises,
  documents,
  aiChat,
}

class StudyContent {
  final String summary;
  final List<Flashcard> flashcards;
  final List<QuizQuestion> quizQuestions;
  final List<Exercise> exercises;
  final List<FeynmanTopic> feynmanTopics;

  StudyContent({
    this.summary = '',
    this.flashcards = const [],
    this.quizQuestions = const [],
    this.exercises = const [],
    this.feynmanTopics = const [],
  });

  factory StudyContent.fromJson(Map<String, dynamic> json) {
    try {
      // Safely parse flashcards - handle both simple and spaced repetition formats
      List<Flashcard> parsedFlashcards = [];
      if (json['flashcards'] != null) {
        try {
          final flashcardsList = json['flashcards'] as List<dynamic>?;
          if (flashcardsList != null) {
            parsedFlashcards = flashcardsList
                .where((f) => f != null && f is Map<String, dynamic>)
                .map((f) {
                  try {
                    return Flashcard.fromJson(f as Map<String, dynamic>);
                  } catch (e) {
                    AppLogger.warning('Error parsing flashcard', error: e, tag: 'StudyContent');
                    return null;
                  }
                })
                .whereType<Flashcard>()
                .toList();
          }
        } catch (e) {
          AppLogger.warning('Error parsing flashcards array', error: e, tag: 'StudyContent');
        }
      }

      // Safely parse quiz questions
      List<QuizQuestion> parsedQuizQuestions = [];
      if (json['quiz_questions'] != null) {
        try {
          final quizList = json['quiz_questions'] as List<dynamic>?;
          if (quizList != null) {
            parsedQuizQuestions = quizList
                .where((q) => q != null && q is Map<String, dynamic>)
                .map((q) {
                  try {
                    return QuizQuestion.fromJson(q as Map<String, dynamic>);
                  } catch (e) {
                    AppLogger.warning('Error parsing quiz question', error: e, tag: 'StudyContent');
                    return null;
                  }
                })
                .whereType<QuizQuestion>()
                .toList();
          }
        } catch (e) {
          AppLogger.warning('Error parsing quiz questions array', error: e, tag: 'StudyContent');
        }
      }

      // Safely parse exercises
      List<Exercise> parsedExercises = [];
      if (json['exercises'] != null) {
        try {
          final exercisesList = json['exercises'] as List<dynamic>?;
          if (exercisesList != null) {
            parsedExercises = exercisesList
                .where((e) => e != null && e is Map<String, dynamic>)
                .map((e) {
                  try {
                    return Exercise.fromJson(e as Map<String, dynamic>);
                  } catch (e) {
                    AppLogger.warning('Error parsing exercise', error: e, tag: 'StudyContent');
                    return null;
                  }
                })
                .whereType<Exercise>()
                .toList();
          }
        } catch (e) {
          AppLogger.warning('Error parsing exercises array', error: e, tag: 'StudyContent');
        }
      }

      // Safely parse feynman topics
      List<FeynmanTopic> parsedFeynmanTopics = [];
      if (json['feynman_topics'] != null) {
        try {
          final topicsList = json['feynman_topics'] as List<dynamic>?;
          if (topicsList != null) {
            parsedFeynmanTopics = topicsList
                .where((t) => t != null && t is Map<String, dynamic>)
                .map((t) {
                  try {
                    return FeynmanTopic.fromJson(t as Map<String, dynamic>);
                  } catch (e) {
                    AppLogger.warning('Error parsing feynman topic', error: e, tag: 'StudyContent');
                    return null;
                  }
                })
                .whereType<FeynmanTopic>()
                .toList();
          }
        } catch (e) {
          AppLogger.warning('Error parsing feynman topics array', error: e, tag: 'StudyContent');
        }
      }

      return StudyContent(
        summary: json['summary'] as String? ?? '',
        flashcards: parsedFlashcards,
        quizQuestions: parsedQuizQuestions,
        exercises: parsedExercises,
        feynmanTopics: parsedFeynmanTopics,
      );
    } catch (e) {
      AppLogger.error('Error parsing StudyContent', error: e, tag: 'StudyContent');
      // Return empty content on error rather than crashing
      return StudyContent();
    }
  }
}

class Flashcard {
  final String id;
  final String front;
  final String back;

  Flashcard({
    required this.id,
    required this.front,
    required this.back,
  });

  factory Flashcard.fromJson(Map<String, dynamic> json) {
    // Handle both simple format and spaced repetition format from web app
    return Flashcard(
      id: json['id'] as String? ?? '',
      front: json['front'] as String? ?? '',
      back: json['back'] as String? ?? '',
    );
  }
}

class QuizQuestion {
  final String id;
  final String question;
  final List<String> options;
  final int correctAnswer;
  int? userAnswer;

  QuizQuestion({
    required this.id,
    required this.question,
    required this.options,
    required this.correctAnswer,
    this.userAnswer,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      id: json['id'] as String? ?? '',
      question: json['question'] as String? ?? '',
      options: (json['options'] as List<dynamic>?)?.cast<String>() ?? [],
      correctAnswer: json['correct'] as int? ?? json['correctAnswer'] as int? ?? 0,
      userAnswer: json['userAnswer'] as int?,
    );
  }
}

class Exercise {
  final String id;
  final String question;
  final String? answer;
  final String? solution;
  final String? notes; // Additional notes field from web app

  Exercise({
    required this.id,
    required this.question,
    this.answer,
    this.solution,
    this.notes,
  });

  factory Exercise.fromJson(Map<String, dynamic> json) {
    return Exercise(
      id: json['id'] as String? ?? '',
      question: json['question'] as String? ?? '',
      answer: json['answer'] as String?,
      solution: json['solution'] as String?,
      notes: json['notes'] as String?,
    );
  }
}

class FeynmanTopic {
  final String id;
  final String title;
  final String description;

  FeynmanTopic({
    required this.id,
    required this.title,
    required this.description,
  });

  factory FeynmanTopic.fromJson(Map<String, dynamic> json) {
    return FeynmanTopic(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
    );
  }
}

