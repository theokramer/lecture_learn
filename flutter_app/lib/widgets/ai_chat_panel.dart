import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../models/chat_message.dart';
import '../services/ai_gateway_service.dart';
import '../providers/auth_provider.dart';
import '../providers/app_data_provider.dart';

class AIChatPanel extends ConsumerStatefulWidget {
  final String noteId;

  const AIChatPanel({super.key, required this.noteId});

  @override
  ConsumerState<AIChatPanel> createState() => _AIChatPanelState();
}

class _AIChatPanelState extends ConsumerState<AIChatPanel> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadConversation();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadConversation() async {
    setState(() {
      _messages.add(ChatMessage(
        id: '1',
        role: 'assistant',
        content:
            "I'm your personal tutor! I can help explain concepts, answer questions, and guide your learning. What would you like to explore?",
        timestamp: DateTime.now(),
      ));
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _isLoading) return;

    final user = ref.read(authProvider).value;
    if (user == null) return;

    final userMessage = ChatMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      role: 'user',
      content: text,
      timestamp: DateTime.now(),
    );

    setState(() {
      _messages.add(userMessage);
      _isLoading = true;
    });

    _messageController.clear();
    _scrollToBottom();
    HapticFeedback.lightImpact();

    try {
      final appData = ref.read(appDataProvider);
      final note = appData.notes.firstWhere(
        (n) => n.id == widget.noteId,
        orElse: () => throw Exception('Note not found'),
      );

      final aiGateway = AIGatewayService();

      final messages = <Map<String, String>>[];
      if (note.content.isNotEmpty) {
        messages.add({
          'role': 'system',
          'content':
              'You are a helpful educational assistant. Use the following context from the note to answer questions: ${note.content}',
        });
      }
      messages.add({
        'role': 'user',
        'content': text,
      });

      final response = await aiGateway.chatCompletion(
        messages,
        model: 'gpt-4o-mini',
        temperature: 0.7,
      );

      final aiMessage = ChatMessage(
        id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: DateTime.now(),
      );

      setState(() {
        _messages.add(aiMessage);
        _isLoading = false;
      });

      _scrollToBottom();
      HapticFeedback.selectionClick();
    } catch (e) {
      HapticFeedback.heavyImpact();
      setState(() {
        _messages.add(ChatMessage(
          id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
          role: 'assistant',
          content: "I'm sorry, I couldn't process your request. Please try again.",
          timestamp: DateTime.now(),
        ));
        _isLoading = false;
      });
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header
        Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: Color(0xFF2A2A2A),
            border: Border(
              bottom: BorderSide(
                color: Color(0xFF3A3A3A),
                width: 0.5,
              ),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF06B6D4),
                      Color(0xFF0891B2),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF06B6D4).withOpacity(0.3),
                      blurRadius: 8,
                      spreadRadius: 0,
                    ),
                  ],
                ),
                child: const Icon(
                  CupertinoIcons.sparkles,
                  color: Color(0xFFFFFFFF),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'AI Tutor',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        // Messages
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(20),
            itemCount: _messages.length + (_isLoading ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == _messages.length) {
                return const Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(
                    child: CupertinoActivityIndicator(
                      radius: 12,
                    ),
                  ),
                );
              }

              final message = _messages[index];
              final isUser = message.role == 'user';

              return Align(
                alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.75,
                  ),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: isUser
                        ? const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Color(0xFF06B6D4),
                              Color(0xFF0891B2),
                            ],
                          )
                        : null,
                    color: isUser ? null : const Color(0xFF2A2A2A),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(18),
                      topRight: const Radius.circular(18),
                      bottomLeft: Radius.circular(isUser ? 18 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 18),
                    ),
                    boxShadow: isUser
                        ? [
                            BoxShadow(
                              color: const Color(0xFF06B6D4).withOpacity(0.3),
                              blurRadius: 8,
                              spreadRadius: 0,
                            ),
                          ]
                        : null,
                  ),
                  child: isUser
                      ? Text(
                          message.content,
                          style: const TextStyle(
                            color: Color(0xFFFFFFFF),
                            fontSize: 15,
                            height: 1.4,
                          ),
                          maxLines: 50,
                          overflow: TextOverflow.ellipsis,
                        )
                      : MarkdownBody(
                          data: message.content,
                          styleSheet: MarkdownStyleSheet(
                            p: const TextStyle(
                              color: Color(0xFFFFFFFF),
                              fontSize: 15,
                              height: 1.4,
                            ),
                            code: const TextStyle(
                              color: Color(0xFF06B6D4),
                              backgroundColor: Color(0xFF1A1A1A),
                            ),
                            codeblockDecoration: BoxDecoration(
                              color: const Color(0xFF1A1A1A),
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                ),
              );
            },
          ),
        ),
        // Input
        Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Color(0xFF2A2A2A),
            border: Border(
              top: BorderSide(
                color: Color(0xFF3A3A3A),
                width: 0.5,
              ),
            ),
          ),
          child: SafeArea(
            top: false,
            child: Row(
              children: [
                Expanded(
                  child: CupertinoTextField(
                    controller: _messageController,
                    placeholder: 'Ask anything...',
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    maxLines: 5,
                    minLines: 1,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A1A1A),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFF3A3A3A),
                        width: 1,
                      ),
                    ),
                    style: const TextStyle(
                      color: Color(0xFFFFFFFF),
                      fontSize: 16,
                    ),
                    placeholderStyle: const TextStyle(
                      color: Color(0xFF9CA3AF),
                      fontSize: 16,
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 12),
                CupertinoButton(
                  padding: EdgeInsets.zero,
                  minSize: 0,
                  onPressed: _isLoading ? null : _sendMessage,
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: _isLoading
                          ? null
                          : const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                Color(0xFF06B6D4),
                                Color(0xFF0891B2),
                              ],
                            ),
                      color: _isLoading ? const Color(0xFF3A3A3A) : null,
                      shape: BoxShape.circle,
                      boxShadow: _isLoading
                          ? null
                          : [
                              BoxShadow(
                                color: const Color(0xFF06B6D4).withOpacity(0.4),
                                blurRadius: 12,
                                spreadRadius: 0,
                              ),
                            ],
                    ),
                    child: _isLoading
                        ? const CupertinoActivityIndicator(
                            color: Color(0xFFFFFFFF),
                            radius: 10,
                          )
                        : const Icon(
                            CupertinoIcons.arrow_up,
                            color: Color(0xFFFFFFFF),
                            size: 20,
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
