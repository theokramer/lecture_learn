import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../services/ai_gateway_service.dart';
import '../providers/auth_provider.dart';
import '../providers/app_data_provider.dart';
import '../utils/error_handler.dart';
import '../widgets/free_notes_limit_widget.dart';

class WebLinkScreen extends ConsumerStatefulWidget {
  final String? folderId;
  
  const WebLinkScreen({super.key, this.folderId});

  @override
  ConsumerState<WebLinkScreen> createState() => _WebLinkScreenState();
}

class _WebLinkScreenState extends ConsumerState<WebLinkScreen> {
  final _urlController = TextEditingController();
  bool _isProcessing = false;

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _processLink() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;

    setState(() {
      _isProcessing = true;
    });

    try {
      HapticFeedback.mediumImpact();
      
      final authState = ref.read(authProvider);
      final user = authState.value;
      
      if (user == null) {
        throw Exception('User not authenticated');
      }

      // Check if user can create notes with study content BEFORE processing
      final appData = ref.read(appDataProvider.notifier);
      try {
        final canCreate = await appData.canCreateNoteWithStudyContent();
        if (!canCreate) {
          // This shouldn't happen as exception is thrown, but handle it anyway
          if (mounted) {
            setState(() {
              _isProcessing = false;
            });
            _showLimitReachedDialog();
          }
          return;
        }
      } catch (e) {
        if (e is NoteCreationLimitException) {
          if (mounted) {
            setState(() {
              _isProcessing = false;
            });
            _showLimitReachedDialog();
          }
          return;
        }
        rethrow;
      }

      // Process the web link
      final result = await AIGatewayService().processWebLink(url, userId: user.id);

      if (mounted) {
        // Navigate to processing screen with the extracted content
        final folderIdParam = widget.folderId != null ? '?folderId=${widget.folderId}' : '';
        context.push(
          '/note-creation/processing$folderIdParam',
          extra: {
            'text': result['content'] as String,
            'title': result['title'] as String,
            'sourceUrl': url,
          },
        );
      }
    } catch (e) {
      ErrorHandler.logError(e, context: 'Processing web link', tag: 'WebLinkScreen');
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });

        final errorMessage = ErrorHandler.getUserFriendlyMessage(e);
        showCupertinoDialog(
          context: context,
          builder: (context) => CupertinoAlertDialog(
            title: const Text('Error'),
            content: Text(errorMessage),
            actions: [
              CupertinoDialogAction(
                child: const Text('OK'),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        );
      }
    }
  }

  void _showLimitReachedDialog() {
    showCupertinoModalPopup(
      context: context,
      builder: (context) => FreeNotesLimitWidget(
        onDismiss: () {
          if (mounted) {
            Navigator.of(context).pop();
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      navigationBar: CupertinoNavigationBar(
        backgroundColor: const Color(0xFF2A2A2A),
        border: const Border(
          bottom: BorderSide(
            color: Color(0xFF3A3A3A),
            width: 0.5,
          ),
        ),
        middle: const Text(
          'Add Web Link',
          style: TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        leading: CupertinoNavigationBarBackButton(
          onPressed: () {
            HapticFeedback.selectionClick();
            Navigator.of(context).pop();
          },
          color: const Color(0xFFFFFFFF),
        ),
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              const Text(
                'Add Web Link',
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Enter a URL to extract content',
                style: TextStyle(
                  fontSize: 17,
                  color: Color(0xFF9CA3AF),
                  fontWeight: FontWeight.w400,
                ),
              ),
              const SizedBox(height: 48),
              CupertinoTextField(
                controller: _urlController,
                placeholder: 'https://example.com/article',
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFF2A2A2A),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: const Color(0xFF3A3A3A),
                    width: 1.5,
                  ),
                ),
                style: const TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 16,
                ),
                placeholderStyle: const TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 16,
                ),
                keyboardType: TextInputType.url,
                textInputAction: TextInputAction.done,
                onChanged: (value) {
                  setState(() {}); // Update button state
                },
                onSubmitted: (_) => _processLink(),
              ),
              const SizedBox(height: 12),
              const Text(
                'Supports: Websites, Google Drive links, and other web pages',
                style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF9CA3AF),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              CupertinoButton.filled(
                onPressed: _urlController.text.trim().isNotEmpty && !_isProcessing
                    ? _processLink
                    : null,
                color: const Color(0xFF3B82F6),
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(vertical: 16),
                disabledColor: const Color(0xFF3A3A3A),
                child: _isProcessing
                    ? const CupertinoActivityIndicator(color: Color(0xFFFFFFFF))
                    : Text(
                        'Process Link',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: (_urlController.text.trim().isNotEmpty && !_isProcessing)
                              ? const Color(0xFFFFFFFF)
                              : const Color(0xFF9CA3AF),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

