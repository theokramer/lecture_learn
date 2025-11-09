import 'document.dart';

class Note {
  final String id;
  final String title;
  final String content;
  final DateTime createdAt;
  final List<Document> documents;
  final String? folderId;

  Note({
    required this.id,
    required this.title,
    required this.content,
    required this.createdAt,
    required this.documents,
    this.folderId,
  });

  Note copyWith({
    String? id,
    String? title,
    String? content,
    DateTime? createdAt,
    List<Document>? documents,
    String? folderId,
  }) {
    return Note(
      id: id ?? this.id,
      title: title ?? this.title,
      content: content ?? this.content,
      createdAt: createdAt ?? this.createdAt,
      documents: documents ?? this.documents,
      folderId: folderId ?? this.folderId,
    );
  }

  factory Note.fromJson(Map<String, dynamic> json) {
    return Note(
      id: json['id'] as String,
      title: json['title'] as String,
      content: json['content'] as String? ?? '',
      createdAt: DateTime.parse(json['created_at'] as String),
      documents: (json['documents'] as List<dynamic>?)
              ?.map((d) => Document.fromJson(d))
              .toList() ??
          [],
      folderId: json['folder_id'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'content': content,
      'created_at': createdAt.toIso8601String(),
      'documents': documents.map((d) => d.toJson()).toList(),
      'folder_id': folderId,
    };
  }
}

