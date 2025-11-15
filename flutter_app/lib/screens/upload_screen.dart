import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import '../providers/app_data_provider.dart';
import '../utils/error_handler.dart';

class UploadScreen extends ConsumerStatefulWidget {
  final String? folderId;
  
  const UploadScreen({super.key, this.folderId});

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> {
  List<File> _selectedFiles = [];
  bool _isUploading = false;

  Future<void> _pickFiles() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'mp3', 'wav', 'mp4'],
        allowMultiple: true,
      );

      if (result != null && result.files.isNotEmpty) {
        setState(() {
          _selectedFiles = result.paths
              .where((path) => path != null)
              .map((path) => File(path!))
              .toList();
        });
      }
    } catch (e) {
      ErrorHandler.logError(e, context: 'Picking files', tag: 'UploadScreen');
      if (mounted) {
        final errorMessage = ErrorHandler.getUserFriendlyMessage(e);
        showCupertinoDialog(
          context: context,
          builder: (context) => CupertinoAlertDialog(
            title: const Text('Error'),
            content: Text(errorMessage),
            actions: [
              CupertinoDialogAction(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    }
  }

  Future<void> _uploadFiles() async {
    if (_selectedFiles.isEmpty) return;

    setState(() {
      _isUploading = true;
    });

    try {
      final title = _selectedFiles.length == 1
          ? _selectedFiles[0].path.split('/').last.replaceAll(RegExp(r'\.[^.]*$'), '')
          : 'Uploaded ${_selectedFiles.length} files';

      await ref.read(appDataProvider.notifier).processUploadedFiles(_selectedFiles, title, folderId: widget.folderId);

      if (mounted) {
        final noteId = ref.read(appDataProvider).selectedNoteId;
        
        // Navigate back to home first (clearing the note creation flow)
        // Then navigate to the note if it was created
        if (noteId != null) {
          // Go to home (this clears the navigation stack)
          context.go('/home');
          // Then push the note screen on top
          Future.delayed(const Duration(milliseconds: 150), () {
            if (mounted && context.mounted) {
              context.push('/note?id=$noteId');
            }
          });
        } else {
          // Just go back to home
          context.go('/home');
        }
      }
    } catch (e) {
      ErrorHandler.logError(e, context: 'Uploading files', tag: 'UploadScreen');
      if (mounted) {
        setState(() {
          _isUploading = false;
        });

        final errorMessage = ErrorHandler.getUserFriendlyMessage(e);
        showCupertinoDialog(
          context: context,
          builder: (context) => CupertinoAlertDialog(
            title: const Text('Error'),
            content: Text(errorMessage),
            actions: [
              CupertinoDialogAction(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    }
  }

  void _removeFile(int index) {
    setState(() {
      _selectedFiles.removeAt(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      navigationBar: const CupertinoNavigationBar(
        backgroundColor: Color(0xFF2A2A2A),
        border: Border(
          bottom: BorderSide(
            color: Color(0xFF3A3A3A),
            width: 0.5,
          ),
        ),
        middle: Text(
          'Upload Documents',
          style: TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Upload Documents',
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Upload your documents, audio, or video files',
                style: TextStyle(
                  fontSize: 17,
                  color: Color(0xFF9CA3AF),
                  fontWeight: FontWeight.w400,
                ),
              ),
              const SizedBox(height: 32),
              // Upload Area
              GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  _pickFiles();
                },
                child: Container(
                  padding: const EdgeInsets.all(48),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2A2A2A),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFF3A3A3A),
                      style: BorderStyle.solid,
                      width: 2,
                    ),
                  ),
                  child: Column(
                    children: [
                      const Icon(
                        CupertinoIcons.cloud_upload,
                        size: 64,
                        color: Color(0xFF9CA3AF),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Tap to select files',
                        style: TextStyle(
                          fontSize: 18,
                          color: Color(0xFFFFFFFF),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'PDF, DOC, DOCX, TXT, MD, MP3, WAV, MP4',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF9CA3AF),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // Selected Files
              if (_selectedFiles.isNotEmpty) ...[
                const SizedBox(height: 32),
                const Text(
                  'Selected Files',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFFFFFFF),
                  ),
                ),
                const SizedBox(height: 16),
                ...List.generate(_selectedFiles.length, (index) {
                  final file = _selectedFiles[index];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2A2A2A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF3A3A3A)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          CupertinoIcons.doc_text,
                          color: Color(0xFF9CA3AF),
                          size: 24,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                file.path.split('/').last,
                                style: const TextStyle(
                                  color: Color(0xFFFFFFFF),
                                  fontSize: 16,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                '${(file.lengthSync() / 1024).toStringAsFixed(2)} KB',
                                style: const TextStyle(
                                  color: Color(0xFF9CA3AF),
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        ),
                        CupertinoButton(
                          padding: EdgeInsets.zero,
                          onPressed: () => _removeFile(index),
                          child: const Icon(
                            CupertinoIcons.delete,
                            color: Color(0xFFEF4444),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
              const SizedBox(height: 32),
              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: CupertinoButton(
                      onPressed: _isUploading
                          ? null
                          : () {
                              HapticFeedback.selectionClick();
                              context.pop();
                            },
                      color: const Color(0xFF2A2A2A),
                      borderRadius: BorderRadius.circular(14),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: CupertinoButton.filled(
                      onPressed: _isUploading || _selectedFiles.isEmpty
                          ? null
                          : () {
                              HapticFeedback.mediumImpact();
                              _uploadFiles();
                            },
                      color: const Color(0xFFFFFFFF),
                      disabledColor: const Color(0xFF3A3A3A),
                      borderRadius: BorderRadius.circular(14),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: _isUploading
                          ? const CupertinoActivityIndicator(
                              color: Color(0xFFFFFFFF),
                              radius: 10,
                            )
                          : const Text(
                              'Upload',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

