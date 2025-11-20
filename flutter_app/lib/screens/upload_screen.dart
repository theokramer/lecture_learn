import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import '../providers/app_data_provider.dart';
import '../utils/error_handler.dart';
import '../utils/validation.dart';
import '../constants/app_constants.dart';
import '../widgets/free_notes_limit_widget.dart';

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
        final validFiles = <File>[];
        final invalidFiles = <String>[];
        
        for (final path in result.paths) {
          if (path != null) {
            final file = File(path);
            final fileName = file.path.split('/').last.toLowerCase();
            final isAudio = AppConstants.allowedAudioFormats.any(
              (ext) => fileName.endsWith('.$ext'),
            );
            
            // Check file size - use audio limit for audio files, regular limit for others
            if (isAudio) {
              if (ValidationUtils.isValidAudioFileSize(file)) {
                validFiles.add(file);
              } else {
                final sizeMB = (file.lengthSync() / (1024 * 1024)).toStringAsFixed(2);
                invalidFiles.add('${file.path.split('/').last} (${sizeMB} MB - max 100 MB)');
              }
            } else {
              if (ValidationUtils.isValidFileSize(file)) {
                validFiles.add(file);
              } else {
                final sizeMB = (file.lengthSync() / (1024 * 1024)).toStringAsFixed(2);
                invalidFiles.add('${file.path.split('/').last} (${sizeMB} MB - max 50 MB)');
              }
            }
          }
        }
        
        if (invalidFiles.isNotEmpty && mounted) {
          showCupertinoDialog(
            context: context,
            builder: (context) => CupertinoAlertDialog(
              title: const Text('File Too Large'),
              content: Text(
                'The following files exceed the size limit:\n\n${invalidFiles.join('\n')}\n\nPlease select smaller files.',
              ),
              actions: [
                CupertinoDialogAction(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('OK'),
                ),
              ],
            ),
          );
        }
        
        if (validFiles.isNotEmpty) {
          setState(() {
            _selectedFiles = validFiles;
          });
        }
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

    // Validate file sizes before uploading
    final invalidFiles = <String>[];
    for (final file in _selectedFiles) {
      final fileName = file.path.split('/').last.toLowerCase();
      final isAudio = AppConstants.allowedAudioFormats.any(
        (ext) => fileName.endsWith('.$ext'),
      );
      
      if (isAudio) {
        if (!ValidationUtils.isValidAudioFileSize(file)) {
          final sizeMB = (await file.length()) / (1024 * 1024);
          invalidFiles.add('${file.path.split('/').last} (${sizeMB.toStringAsFixed(2)} MB)');
        }
      } else {
        if (!ValidationUtils.isValidFileSize(file)) {
          final sizeMB = (await file.length()) / (1024 * 1024);
          invalidFiles.add('${file.path.split('/').last} (${sizeMB.toStringAsFixed(2)} MB)');
        }
      }
    }
    
    if (invalidFiles.isNotEmpty && mounted) {
      showCupertinoDialog(
        context: context,
        builder: (context) => CupertinoAlertDialog(
          title: const Text('File Too Large'),
          content: Text(
            'The following files exceed the size limit:\n\n${invalidFiles.join('\n')}\n\nAudio files: max 100 MB\nOther files: max 50 MB',
          ),
          actions: [
            CupertinoDialogAction(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    setState(() {
      _isUploading = true;
    });

    try {
      // Check if user can create notes with study content
      final appData = ref.read(appDataProvider.notifier);
      try {
        final canCreate = await appData.canCreateNoteWithStudyContent();
        if (!canCreate) {
          // This shouldn't happen as exception is thrown, but handle it anyway
          if (mounted) {
            setState(() {
              _isUploading = false;
            });
            _showLimitReachedDialog();
          }
          return;
        }
      } catch (e) {
        if (e is NoteCreationLimitException) {
          if (mounted) {
            setState(() {
              _isUploading = false;
            });
            _showLimitReachedDialog();
          }
          return;
        }
        rethrow;
      }

      final title = _selectedFiles.length == 1
          ? _selectedFiles[0].path.split('/').last.replaceAll(RegExp(r'\.[^.]*$'), '')
          : 'Uploaded ${_selectedFiles.length} files';

      await appData.processUploadedFiles(_selectedFiles, title, folderId: widget.folderId);

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
      // Handle note creation limit exception
      if (e is NoteCreationLimitException) {
        if (mounted) {
          setState(() {
            _isUploading = false;
          });
          _showLimitReachedDialog();
        }
        return;
      }

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

  void _showLimitReachedDialog() {
    showCupertinoModalPopup(
      context: context,
      builder: (context) => FreeNotesLimitWidget(
        onDismiss: () {
          if (mounted) {
            Navigator.of(context).pop();
            context.pop();
          }
        },
      ),
    );
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
                          color: Color(0xFFFFFFFF),
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
                          : Text(
                              'Upload',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                                color: (_isUploading || _selectedFiles.isEmpty)
                                    ? const Color(0xFF9CA3AF)
                                    : const Color(0xFF1A1A1A),
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

