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
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          minSize: 0,
          onPressed: () {
            HapticFeedback.selectionClick();
            context.push('/settings');
          },
          child: const Icon(
            CupertinoIcons.settings,
            color: Colors.white,
            size: 24,
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
              color: Colors.white,
              size: 24,
          ),
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
                            gradient: LinearGradient(
                              colors: OnboardingColors.notificationButtonGradientColors,
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
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
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: const Color(0xFF2F2F2F),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(
                  CupertinoIcons.doc_text,
                  size: 48,
                  color: Color(0xFFFFFFFF),
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                'Start Your Learning Journey',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -0.5,
                  height: 1.2,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                'Create your first note to begin',
                style: TextStyle(
                  fontSize: 15,
                  color: const Color(0xFF8E8E93).withOpacity(0.9),
                  fontWeight: FontWeight.w400,
                  letterSpacing: -0.2,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: OnboardingColors.buttonGradientColors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: OnboardingColors.buttonGradientColors[0].withOpacity(0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: CupertinoButton(
                  onPressed: () {
                    HapticFeedback.mediumImpact();
                    context.push('/note-creation');
                  },
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        CupertinoIcons.add_circled_solid,
                        size: 20,
                        color: Colors.black,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Create Your First Note',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
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
