class User {
  final String id;
  final String email;
  final String name;

  User({
    required this.id,
    required this.email,
    required this.name,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String? ?? '',
      name: json['user_metadata']?['name'] as String? ??
          (json['email'] as String?)?.split('@').first ??
          'User',
    );
  }
}

