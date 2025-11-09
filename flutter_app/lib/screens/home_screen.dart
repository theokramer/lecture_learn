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
import 'folder_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
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
          'Notes',
          style: TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          minSize: 0,
          onPressed: () {
            HapticFeedback.selectionClick();
            _showCreateFolderDialog(context);
          },
          child: const Icon(
            CupertinoIcons.folder_badge_plus,
            color: Color(0xFFB85A3A),
            size: 24,
          ),
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            // Search Bar
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: Color(0xFF3A3A3A),
                    width: 0.5,
                  ),
                ),
              ),
              child: CupertinoSearchTextField(
                controller: _searchController,
                placeholder: 'Search notes...',
                onChanged: (value) {
                  setState(() {
                    _searchQuery = value;
                  });
                },
                style: const TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
                placeholderStyle: const TextStyle(
                  color: Color(0xFF6B7280),
                  fontSize: 16,
                ),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      const Color(0xFF2A2A2A),
                      const Color(0xFF252525),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _searchQuery.isNotEmpty
                        ? const Color(0xFFB85A3A).withOpacity(0.5)
                        : const Color(0xFF3A3A3A),
                    width: _searchQuery.isNotEmpty ? 1.5 : 1,
                  ),
                  boxShadow: _searchQuery.isNotEmpty
                      ? [
                          BoxShadow(
                            color: const Color(0xFFB85A3A).withOpacity(0.2),
                            blurRadius: 8,
                            spreadRadius: 0,
                          ),
                        ]
                      : null,
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
                      : _buildContent(context, appData),
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
                          context.push('/note-creation');
                        },
                        child: Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: const Color(0xFF6366F1), // Indigo - matches primary color
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.2),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Icon(
                            CupertinoIcons.add,
                            color: Color(0xFFFFFFFF),
                            size: 30,
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

  Widget _buildContent(BuildContext context, AppDataState appData) {
    // Get root folders (no parent) and root notes (no folder)
    final folders = appData.folders.where((f) => f.parentId == null).toList();
    final notes = _searchQuery.isEmpty
        ? appData.notes.where((n) => n.folderId == null).toList()
        : appData.notes
            .where((n) =>
                n.folderId == null &&
                (n.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                    n.content.toLowerCase().contains(_searchQuery.toLowerCase())))
            .toList();

    if (folders.isEmpty && notes.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFFB85A3A),
                      Color(0xFFD47A5A),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFB85A3A).withOpacity(0.4),
                      blurRadius: 30,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: const Icon(
                  CupertinoIcons.sparkles,
                  size: 60,
                  color: Color(0xFFFFFFFF),
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                'Start Your Learning Journey',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -0.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'Create your first note to begin',
                style: TextStyle(
                  fontSize: 16,
                  color: const Color(0xFF9CA3AF).withOpacity(0.9),
                  fontWeight: FontWeight.w400,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              CupertinoButton.filled(
                onPressed: () {
                  HapticFeedback.mediumImpact();
                  context.push('/note-creation');
                },
                color: const Color(0xFFB85A3A),
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.add_circled_solid,
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Create Your First Note',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
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

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: folders.length + notes.length,
      itemBuilder: (context, index) {
        if (index < folders.length) {
          final folder = folders[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
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
            padding: const EdgeInsets.only(bottom: 12),
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


  void _showCreateFolderDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => CreateFolderDialog(
        onCreated: (name) {
          HapticFeedback.mediumImpact();
          ref.read(appDataProvider.notifier).createFolder(
                name,
                null, // Root folder
              );
        },
      ),
    );
  }

  void _showItemOptions(BuildContext context, {Folder? folder, Note? note}) {
    final isFolder = folder != null;
    final title = folder?.name ?? note?.title ?? '';
    
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
              if (isFolder && folder != null) {
                _showMoveFolderDialog(context, folder);
              } else if (note != null) {
                _showMoveNoteDialog(context, note);
              }
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  CupertinoIcons.folder,
                  size: 20,
                  color: Color(0xFFB85A3A),
                ),
                SizedBox(width: 8),
                Text(
                  'Move',
                  style: TextStyle(
                    fontSize: 17,
                    color: Color(0xFFB85A3A),
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
              if (isFolder && folder != null) {
                _deleteFolder(context, folder);
              } else if (note != null) {
                _deleteNote(context, note);
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
    final folders = appData.folders.where((f) => f.id != note.folderId).toList();
    
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
                  color: Color(0xFFB85A3A),
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
                      color: Color(0xFFB85A3A),
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
        .where((f) => f.id != folder.id && f.parentId != folder.id)
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
                  color: Color(0xFFB85A3A),
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
                      color: Color(0xFFB85A3A),
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
