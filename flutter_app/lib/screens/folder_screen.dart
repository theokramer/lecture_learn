import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:animations/animations.dart';
import '../providers/app_data_provider.dart';
import '../models/note.dart';
import '../models/folder.dart';
import '../widgets/folder_note_item.dart';
import '../widgets/create_folder_dialog.dart';
import '../constants/onboarding_colors.dart';

class FolderScreen extends ConsumerStatefulWidget {
  final String folderId;
  final String folderName;

  const FolderScreen({
    super.key,
    required this.folderId,
    required this.folderName,
  });

  @override
  ConsumerState<FolderScreen> createState() => _FolderScreenState();
}

class _FolderScreenState extends ConsumerState<FolderScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appData = ref.watch(appDataProvider);

    // Get folders and notes for this specific folder
    final folders = appData.folders
        .where((f) => f.parentId == widget.folderId)
        .toList();
    final notes = _searchQuery.isEmpty
        ? appData.notes.where((n) => n.folderId == widget.folderId).toList()
        : appData.notes
            .where((n) =>
                n.folderId == widget.folderId &&
                (n.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                    n.content.toLowerCase().contains(_searchQuery.toLowerCase())))
            .toList();

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
        middle: Text(
          widget.folderName,
          style: const TextStyle(
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
        child: Column(
          children: [
            // Search Bar
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: Color(0xFF2A2A2A),
                    width: 0.5,
                  ),
                ),
              ),
              child: CupertinoSearchTextField(
                controller: _searchController,
                placeholder: 'Search notes',
                onChanged: (value) {
                  setState(() {
                    _searchQuery = value;
                  });
                },
                style: const TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  letterSpacing: -0.2,
                ),
                placeholderStyle: const TextStyle(
                  color: Color(0xFF8E8E93),
                  fontSize: 16,
                  fontWeight: FontWeight.w400,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF1F1F1F),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFF2F2F2F),
                    width: 1,
                  ),
                ),
              ),
            ),
            // Content
            Expanded(
              child: Stack(
                children: [
                  appData.loading
                      ? const Center(
                          child: CupertinoActivityIndicator(
                            radius: 15,
                          ),
                        )
                      : _buildContent(context, folders, notes),
                  // Floating Action Button with animation
                  Positioned(
                    bottom: 24,
                    right: 24,
                    child: OpenContainer(
                      closedElevation: 0,
                      openElevation: 0,
                      closedColor: const Color(0x00000000),
                      openColor: const Color(0x00000000),
                      transitionDuration: const Duration(milliseconds: 300),
                      closedBuilder: (context, action) => GestureDetector(
                        onTap: () {
                          HapticFeedback.mediumImpact();
                          _showCreateOptions(context);
                        },
                        child: Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: OnboardingColors.optionButtonGradientColors,
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            CupertinoIcons.add,
                            color: Color(0xFFFFFFFF),
                            size: 28,
                          ),
                        ),
                      ),
                      openBuilder: (context, action) => Container(),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, List<Folder> folders, List<Note> notes) {
    if (folders.isEmpty && notes.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: const Color(0xFF2F2F2F),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(
                  CupertinoIcons.folder,
                  size: 48,
                  color: Color(0xFFFFFFFF),
                ),
              ),
              const SizedBox(height: 28),
              Text(
                widget.folderName,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -0.5,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'This folder is empty',
                style: TextStyle(
                  fontSize: 15,
                  color: const Color(0xFF8E8E93).withOpacity(0.9),
                  fontWeight: FontWeight.w400,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 36),
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: OnboardingColors.optionButtonGradientColors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: OnboardingColors.optionButtonGradientColors[0].withOpacity(0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: CupertinoButton(
                  onPressed: () {
                    HapticFeedback.mediumImpact();
                    _showCreateOptions(context);
                  },
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        CupertinoIcons.add_circled_solid,
                        size: 20,
                        color: Colors.white,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Create Item',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      itemCount: folders.length + notes.length,
      itemBuilder: (context, index) {
        if (index < folders.length) {
          final folder = folders[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: FolderNoteItem(
              folder: folder,
              onTap: () {
                HapticFeedback.selectionClick();
                Navigator.of(context).push(
                  CupertinoPageRoute(
                    builder: (context) => FolderScreen(
                      folderId: folder.id,
                      folderName: folder.name,
                    ),
                  ),
                );
              },
              onLongPress: () => _showItemOptions(context, folder: folder),
            ),
          );
        } else {
          final note = notes[index - folders.length];
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: FolderNoteItem(
              note: note,
              onTap: () {
                HapticFeedback.selectionClick();
                ref.read(appDataProvider.notifier).setSelectedNoteId(note.id);
                context.push('/note?id=${note.id}');
              },
              onLongPress: () => _showItemOptions(context, note: note),
            ),
          );
        }
      },
    );
  }

  void _showCreateOptions(BuildContext context) {
    showCupertinoModalPopup(
      context: context,
      builder: (context) => CupertinoActionSheet(
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              HapticFeedback.selectionClick();
              Navigator.pop(context);
              _showCreateFolderDialog(context);
            },
            child: const Text(
              'Create Folder',
              style: TextStyle(fontSize: 17),
            ),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              HapticFeedback.selectionClick();
              Navigator.pop(context);
              context.push('/note-creation?folderId=${widget.folderId}');
            },
            child: const Text(
              'Create Note',
              style: TextStyle(fontSize: 17),
            ),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () {
            HapticFeedback.selectionClick();
            Navigator.pop(context);
          },
          isDestructiveAction: true,
          child: const Text(
            'Cancel',
            style: TextStyle(fontSize: 17),
          ),
        ),
      ),
    );
  }

  void _showCreateFolderDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => CreateFolderDialog(
        onCreated: (name) {
          HapticFeedback.mediumImpact();
          ref.read(appDataProvider.notifier).createFolder(
                name,
                widget.folderId,
              );
        },
      ),
    );
  }

  void _showItemOptions(BuildContext context, {Folder? folder, Note? note}) {
    final isFolder = folder != null;
    final title = folder?.name ?? note?.title ?? '';
    final folderValue = folder;
    final noteValue = note;
    
    showCupertinoModalPopup(
      context: context,
      builder: (context) => CupertinoActionSheet(
        title: Text(
          title,
          style: const TextStyle(
            fontSize: 13,
            color: Color(0xFF9CA3AF),
            fontWeight: FontWeight.w400,
          ),
        ),
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              HapticFeedback.selectionClick();
              Navigator.pop(context);
              if (isFolder && folderValue != null) {
                _showMoveFolderDialog(context, folderValue);
              } else if (noteValue != null) {
                _showMoveNoteDialog(context, noteValue);
              }
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                    CupertinoIcons.folder,
                    size: 20,
                    color: Colors.white,
                  ),
                SizedBox(width: 8),
                Text(
                  'Move',
                  style: TextStyle(
                    fontSize: 17,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          CupertinoActionSheetAction(
            isDestructiveAction: true,
            onPressed: () {
              HapticFeedback.mediumImpact();
              Navigator.pop(context);
              if (isFolder && folderValue != null) {
                _deleteFolder(context, folderValue);
              } else if (noteValue != null) {
                _deleteNote(context, noteValue);
              }
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  CupertinoIcons.delete,
                  size: 20,
                ),
                SizedBox(width: 8),
                Text(
                  'Delete',
                  style: TextStyle(fontSize: 17),
                ),
              ],
            ),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () {
            HapticFeedback.selectionClick();
            Navigator.pop(context);
          },
          child: const Text(
            'Cancel',
            style: TextStyle(fontSize: 17),
          ),
        ),
      ),
    );
  }

  void _showMoveNoteDialog(BuildContext context, Note note) {
    final appData = ref.read(appDataProvider);
    // Get folders that are not the current folder
    final folders = appData.folders
        .where((f) => f.id != note.folderId && f.id != widget.folderId)
        .toList();
    
    showCupertinoModalPopup(
      context: context,
      builder: (context) => CupertinoActionSheet(
        title: const Text(
          'Move to Folder',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          // Option to move to current folder (no change, but show for clarity)
          if (note.folderId != widget.folderId)
            CupertinoActionSheetAction(
              onPressed: () {
                HapticFeedback.selectionClick();
                Navigator.pop(context);
                ref.read(appDataProvider.notifier).moveNote(note.id, widget.folderId);
              },
              child: Row(
                children: [
                  const Icon(
                      CupertinoIcons.folder,
                      size: 20,
                      color: Colors.white,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '${widget.folderName} (Current)',
                      style: const TextStyle(fontSize: 17),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          // Option to move to root (no folder)
          CupertinoActionSheetAction(
            onPressed: () {
              HapticFeedback.selectionClick();
              Navigator.pop(context);
              ref.read(appDataProvider.notifier).moveNote(note.id, null);
            },
            child: const Row(
              children: [
                Icon(
                  CupertinoIcons.house,
                  size: 20,
                  color: Colors.white,
                ),
                SizedBox(width: 12),
                Text(
                  'Home (No Folder)',
                  style: TextStyle(fontSize: 17),
                ),
              ],
            ),
          ),
          ...folders.map((folder) => CupertinoActionSheetAction(
                onPressed: () {
                  HapticFeedback.selectionClick();
                  Navigator.pop(context);
                  ref.read(appDataProvider.notifier).moveNote(note.id, folder.id);
                },
                child: Row(
                  children: [
                    const Icon(
                      CupertinoIcons.folder,
                      size: 20,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        folder.name,
                        style: const TextStyle(fontSize: 17),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              )),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () {
            HapticFeedback.selectionClick();
            Navigator.pop(context);
          },
          child: const Text(
            'Cancel',
            style: TextStyle(fontSize: 17),
          ),
        ),
      ),
    );
  }

  void _showMoveFolderDialog(BuildContext context, Folder folder) {
    final appData = ref.read(appDataProvider);
    // Get folders that are not the current folder and not descendants of it
    final availableFolders = appData.folders
        .where((f) => f.id != folder.id && f.parentId != folder.id && f.id != widget.folderId)
        .toList();
    
    showCupertinoModalPopup(
      context: context,
      builder: (context) => CupertinoActionSheet(
        title: const Text(
          'Move to Folder',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          // Option to move to current folder
          if (folder.parentId != widget.folderId)
            CupertinoActionSheetAction(
              onPressed: () {
                HapticFeedback.selectionClick();
                Navigator.pop(context);
                ref.read(appDataProvider.notifier).moveFolder(folder.id, widget.folderId);
              },
              child: Row(
                children: [
                  const Icon(
                      CupertinoIcons.folder,
                      size: 20,
                      color: Colors.white,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '${widget.folderName} (Current)',
                      style: const TextStyle(fontSize: 17),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          // Option to move to root (no parent)
          CupertinoActionSheetAction(
            onPressed: () {
              HapticFeedback.selectionClick();
              Navigator.pop(context);
              ref.read(appDataProvider.notifier).moveFolder(folder.id, null);
            },
            child: const Row(
              children: [
                Icon(
                  CupertinoIcons.house,
                  size: 20,
                  color: Colors.white,
                ),
                SizedBox(width: 12),
                Text(
                  'Home (Root)',
                  style: TextStyle(fontSize: 17),
                ),
              ],
            ),
          ),
          ...availableFolders.map((parentFolder) => CupertinoActionSheetAction(
                onPressed: () {
                  HapticFeedback.selectionClick();
                  Navigator.pop(context);
                  ref.read(appDataProvider.notifier).moveFolder(folder.id, parentFolder.id);
                },
                child: Row(
                  children: [
                    const Icon(
                      CupertinoIcons.folder,
                      size: 20,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        parentFolder.name,
                        style: const TextStyle(fontSize: 17),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              )),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () {
            HapticFeedback.selectionClick();
            Navigator.pop(context);
          },
          child: const Text(
            'Cancel',
            style: TextStyle(fontSize: 17),
          ),
        ),
      ),
    );
  }

  Future<void> _deleteNote(BuildContext context, Note note) async {
    final confirmed = await showCupertinoDialog<bool>(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text(
          'Delete Note',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
        content: Text(
          'Are you sure you want to delete "${note.title}"?',
          style: const TextStyle(fontSize: 15),
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () {
              HapticFeedback.selectionClick();
              Navigator.pop(context, false);
            },
            child: const Text('Cancel'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () {
              HapticFeedback.mediumImpact();
              Navigator.pop(context, true);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(appDataProvider.notifier).deleteNote(note.id);
    }
  }

  Future<void> _deleteFolder(BuildContext context, Folder folder) async {
    final confirmed = await showCupertinoDialog<bool>(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text(
          'Delete Folder',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
        content: Text(
          'Are you sure you want to delete "${folder.name}"? This will also delete all notes inside.',
          style: const TextStyle(fontSize: 15),
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () {
              HapticFeedback.selectionClick();
              Navigator.pop(context, false);
            },
            child: const Text('Cancel'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () {
              HapticFeedback.mediumImpact();
              Navigator.pop(context, true);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(appDataProvider.notifier).deleteFolder(folder.id);
    }
  }
}

