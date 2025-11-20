import '../services/local_document_service.dart';

enum DocumentType { audio, video, pdf, doc, text }

class Document {
  final String id;
  final String name;
  final DocumentType type;
  final String url; // Can be a storage path or local path identifier (starts with "local://")
  final int size;
  final DateTime uploadedAt;

  Document({
    required this.id,
    required this.name,
    required this.type,
    required this.url,
    required this.size,
    required this.uploadedAt,
  });

  /// Check if this document is stored locally
  bool get isLocal => LocalDocumentService.isLocalPath(url);

  factory Document.fromJson(Map<String, dynamic> json) {
    return Document(
      id: json['id'] as String,
      name: json['name'] as String,
      type: _parseDocumentType(json['type'] as String),
      url: json['storage_path'] as String? ?? json['url'] as String,
      size: json['size'] as int,
      uploadedAt: DateTime.parse(json['uploaded_at'] as String),
    );
  }

  static DocumentType _parseDocumentType(String type) {
    switch (type.toLowerCase()) {
      case 'audio':
        return DocumentType.audio;
      case 'video':
        return DocumentType.video;
      case 'pdf':
        return DocumentType.pdf;
      case 'doc':
        return DocumentType.doc;
      default:
        return DocumentType.text;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type.toString().split('.').last,
      'storage_path': url,
      'size': size,
      'uploaded_at': uploadedAt.toIso8601String(),
    };
  }
}

