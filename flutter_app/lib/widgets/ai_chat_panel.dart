import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../models/chat_message.dart';
import '../models/study_content.dart';
import '../services/ai_gateway_service.dart';
import '../services/supabase_service.dart';
import '../providers/auth_provider.dart';
import '../providers/app_data_provider.dart';
import '../utils/logger.dart';

class AIChatPanel extends ConsumerStatefulWidget {
  final String noteId;
  final VoidCallback? onSummaryUpdated; // Callback to reload summary after editing

  const AIChatPanel({
    super.key,
    required this.noteId,
    this.onSummaryUpdated,
  });

  @override
  ConsumerState<AIChatPanel> createState() => _AIChatPanelState();
}

class _AIChatPanelState extends ConsumerState<AIChatPanel> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = false;
  String? _conversationId;
  bool _isLoadingHistory = true;

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
      _isLoadingHistory = true;
    });

    try {
      final user = ref.read(authProvider).value;
      if (user == null) {
        setState(() {
          _isLoadingHistory = false;
          _messages.add(ChatMessage(
            id: '1',
            role: 'assistant',
            content:
                "I'm your personal tutor! I can help explain concepts, answer questions, and guide your learning. What would you like to explore?",
            timestamp: DateTime.now(),
          ));
        });
        return;
      }

      final supabase = SupabaseService();
      
      // Get or create conversation for this note
      _conversationId = await supabase.getOrCreateConversation(user.id, widget.noteId);
      
      // Load existing messages
      final existingMessages = await supabase.loadConversationMessages(_conversationId!);
      
      if (existingMessages.isEmpty) {
        // No history - add welcome message
        setState(() {
          _messages.add(ChatMessage(
            id: '1',
            role: 'assistant',
            content:
                "I'm your personal tutor! I can help explain concepts, answer questions, and guide your learning. What would you like to explore?",
            timestamp: DateTime.now(),
          ));
          _isLoadingHistory = false;
        });
      } else {
        // Load existing messages
        setState(() {
          _messages.addAll(existingMessages);
          _isLoadingHistory = false;
        });
        _scrollToBottom();
      }
    } catch (e) {
      AppLogger.error('Error loading conversation', error: e, tag: 'AIChatPanel');
      setState(() {
        _isLoadingHistory = false;
        _messages.add(ChatMessage(
          id: '1',
          role: 'assistant',
          content:
              "I'm your personal tutor! I can help explain concepts, answer questions, and guide your learning. What would you like to explore?",
          timestamp: DateTime.now(),
        ));
      });
    }
  }

  /// Check if the message is a summary editing command
  bool _isSummaryEditCommand(String text) {
    final lowerText = text.toLowerCase();
    final editKeywords = ['add', 'rewrite', 'remove', 'delete', 'edit', 'modify', 'change', 'update', 'insert'];
    final summaryKeywords = ['summary', 'summaries'];
    
    // Check if message contains edit keywords
    final hasEditKeyword = editKeywords.any((keyword) => lowerText.contains(keyword));
    
    // Check if message contains summary keywords or is clearly an editing instruction
    final hasSummaryKeyword = summaryKeywords.any((keyword) => lowerText.contains(keyword));
    
    // Also check for patterns like "add analogy for x", "rewrite the section about y"
    final hasEditPattern = lowerText.contains('analogy') || 
                          lowerText.contains('section') ||
                          lowerText.contains('part') ||
                          lowerText.contains('paragraph');
    
    return hasEditKeyword && (hasSummaryKeyword || hasEditPattern);
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

      // Ensure conversation ID is set
      if (_conversationId == null) {
        final supabase = SupabaseService();
        _conversationId = await supabase.getOrCreateConversation(user.id, widget.noteId);
      }

      // Save user message to database
      try {
        final supabase = SupabaseService();
        await supabase.saveMessage(_conversationId!, 'user', text);
      } catch (e) {
        AppLogger.warning('Failed to save user message', error: e, tag: 'AIChatPanel');
        // Continue even if save fails
      }

      final aiGateway = AIGatewayService();

      // Check if this is a summary editing command
      if (_isSummaryEditCommand(text)) {
        // Get current summary
        final supabase = SupabaseService();
        final studyContent = await supabase.getStudyContent(widget.noteId);
        
        if (studyContent.summary.isEmpty) {
          final errorMessage = ChatMessage(
            id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
            role: 'assistant',
            content: "I can't edit the summary because there's no summary yet. Please generate a summary first.",
            timestamp: DateTime.now(),
          );
          setState(() {
            _messages.add(errorMessage);
            _isLoading = false;
          });
          
          // Save error message to database
          if (_conversationId != null) {
            try {
              final supabase = SupabaseService();
              await supabase.saveMessage(_conversationId!, 'assistant', errorMessage.content);
            } catch (e) {
              AppLogger.warning('Failed to save error message', error: e, tag: 'AIChatPanel');
            }
          }
          
          _scrollToBottom();
          return;
        }

        // Show editing message
        final editingMessage = ChatMessage(
          id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
          role: 'assistant',
          content: "Editing the summary based on your instructions...",
          timestamp: DateTime.now(),
        );
        setState(() {
          _messages.add(editingMessage);
        });
        _scrollToBottom();
        
        // Save editing message to database
        if (_conversationId != null) {
          try {
            final supabase = SupabaseService();
            await supabase.saveMessage(_conversationId!, 'assistant', editingMessage.content);
          } catch (e) {
            AppLogger.warning('Failed to save editing message', error: e, tag: 'AIChatPanel');
          }
        }

        // Edit the summary
        final editedSummary = await aiGateway.editSummary(
          studyContent.summary,
          text,
          originalContent: note.content,
        );

        // Save the edited summary - create new StudyContent with updated summary
        final updatedContent = StudyContent(
          summary: editedSummary,
          flashcards: studyContent.flashcards,
          quizQuestions: studyContent.quizQuestions,
          exercises: studyContent.exercises,
          feynmanTopics: studyContent.feynmanTopics,
        );
        await supabase.saveStudyContent(widget.noteId, updatedContent);

        // Trigger reload of summary in note view screen
        if (widget.onSummaryUpdated != null) {
          widget.onSummaryUpdated!();
        }

        // Show success message
        final successMessage = ChatMessage(
          id: (DateTime.now().millisecondsSinceEpoch + 2).toString(),
          role: 'assistant',
          content: "✅ Summary updated successfully! The changes have been applied. You can view the updated summary in the Summary tab.",
          timestamp: DateTime.now(),
        );
        setState(() {
          _messages.add(successMessage);
          _isLoading = false;
        });

        // Save success message to database
        if (_conversationId != null) {
          try {
            final supabase = SupabaseService();
            await supabase.saveMessage(_conversationId!, 'assistant', successMessage.content);
          } catch (e) {
            AppLogger.warning('Failed to save success message', error: e, tag: 'AIChatPanel');
          }
        }

        AppLogger.success('Summary edited successfully', tag: 'AIChatPanel');
        _scrollToBottom();
        HapticFeedback.selectionClick();
        return;
      }

      // Regular chat message - include conversation history for context
      final messages = <Map<String, String>>[];
      
      // Add system message with note context
      if (note.content.isNotEmpty) {
        messages.add({
          'role': 'system',
          'content':
              'You are a helpful educational assistant. Use the following context from the note to answer questions: ${note.content}',
        });
      }
      
      // Add conversation history (last 10 messages for context, excluding current message)
      final historyMessages = _messages
          .where((m) => m.role == 'user' || m.role == 'assistant')
          .take(_messages.length - 1) // Exclude the current user message we just added
          .toList();
      
      // Only include recent history to avoid token limits (last 10 messages)
      final recentHistory = historyMessages.length > 10 
          ? historyMessages.sublist(historyMessages.length - 10)
          : historyMessages;
      
      for (final msg in recentHistory) {
        messages.add({
          'role': msg.role,
          'content': msg.content,
        });
      }
      
      // Add current user message
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

      // Save assistant message to database
      if (_conversationId != null) {
        try {
          final supabase = SupabaseService();
          await supabase.saveMessage(_conversationId!, 'assistant', response);
        } catch (e) {
          AppLogger.warning('Failed to save assistant message', error: e, tag: 'AIChatPanel');
          // Continue even if save fails
        }
      }

      _scrollToBottom();
      HapticFeedback.selectionClick();
    } catch (e) {
      HapticFeedback.heavyImpact();
      AppLogger.error('Error in AI chat', error: e, tag: 'AIChatPanel');
      final errorMessage = ChatMessage(
        id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I couldn't process your request. Please try again.",
        timestamp: DateTime.now(),
      );
      setState(() {
        _messages.add(errorMessage);
        _isLoading = false;
      });
      
      // Save error message to database
      if (_conversationId != null) {
        try {
          final supabase = SupabaseService();
          await supabase.saveMessage(_conversationId!, 'assistant', errorMessage.content);
        } catch (saveError) {
          AppLogger.warning('Failed to save error message', error: saveError, tag: 'AIChatPanel');
        }
      }
      
      _scrollToBottom();
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
                      Color(0xFF650941), // Vibrant teal
                      Color(0xFF8D1647),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF8D1647).withOpacity(0.3),
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
          child: _isLoadingHistory
              ? const Center(
                  child: CupertinoActivityIndicator(
                    radius: 15,
                  ),
                )
              : ListView.builder(
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
                                 Color(0xFF650941), // Vibrant teal
    Color(0xFF8D1647) // Vibrant teal
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
                              color: const Color(0xFF8D1647).withOpacity(0.3),
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
                              color: Color(0xFF8D1647),
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
                                   Color(0xFF650941), // Vibrant teal
    Color(0xFF8D1647) // Vibrant teal
                              ],
                            ),
                      color: _isLoading ? const Color(0xFF3A3A3A) : null,
                      shape: BoxShape.circle,
                      boxShadow: _isLoading
                          ? null
                          : [
                              BoxShadow(
                                color: const Color(0xFF8D1647).withOpacity(0.4),
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
