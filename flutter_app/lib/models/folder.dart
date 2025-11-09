class Folder {
  final String id;
  final String name;
  final String? parentId;
  final DateTime createdAt;

  Folder({
    required this.id,
    required this.name,
    this.parentId,
    required this.createdAt,
  });

  factory Folder.fromJson(Map<String, dynamic> json) {
    return Folder(
      id: json['id'] as String,
      name: json['name'] as String,
      parentId: json['parent_id'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'parent_id': parentId,
      'created_at': createdAt.toIso8601String(),
    };
  }
}

