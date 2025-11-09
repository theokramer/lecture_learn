import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:animations/animations.dart';
import '../models/note.dart';
import '../models/folder.dart';

class FolderNoteItem extends StatelessWidget {
  final Folder? folder;
  final Note? note;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  const FolderNoteItem({
    super.key,
    this.folder,
    this.note,
    required this.onTap,
    this.onLongPress,
  }) : assert(folder != null || note != null);

  @override
  Widget build(BuildContext context) {
    final isFolder = folder != null;
    final title = folder?.name ?? note?.title ?? '';
    final date = note?.createdAt;

    return OpenContainer(
      closedElevation: 0,
      openElevation: 0,
      closedColor: Colors.transparent,
      openColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 250),
      closedBuilder: (context, action) => GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        onLongPress: onLongPress != null
            ? () {
                HapticFeedback.mediumImpact();
                onLongPress!();
              }
            : null,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isFolder
                  ? [
                      const Color(0xFF2A2A2A),
                      const Color(0xFF2A1F1A),
                    ]
                  : [
                      const Color(0xFF2A2A2A),
                      const Color(0xFF1F1F2A),
                    ],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isFolder
                  ? const Color(0xFFB85A3A).withOpacity(0.3)
                  : const Color(0xFF3A3A3A),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: isFolder
                          ? [
                              const Color(0xFFB85A3A),
                              const Color(0xFFD47A5A),
                            ]
                          : [
                              const Color(0xFF6366F1),
                              const Color(0xFF8B5CF6),
                            ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: (isFolder
                                ? const Color(0xFFB85A3A)
                                : const Color(0xFF6366F1))
                            .withOpacity(0.4),
                        blurRadius: 12,
                        spreadRadius: 0,
                      ),
                    ],
                  ),
                  child: Icon(
                    isFolder ? CupertinoIcons.folder_fill : CupertinoIcons.doc_text_fill,
                    color: const Color(0xFFFFFFFF),
                    size: 26,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Color(0xFFFFFFFF),
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.4,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (date != null) ...[
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(
                              CupertinoIcons.calendar,
                              size: 12,
                              color: const Color(0xFF9CA3AF).withOpacity(0.8),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              DateFormat('MMM d, yyyy').format(date),
                              style: TextStyle(
                                color: const Color(0xFF9CA3AF).withOpacity(0.9),
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                Icon(
                  CupertinoIcons.chevron_right,
                  color: const Color(0xFF9CA3AF).withOpacity(0.5),
                  size: 18,
                ),
              ],
            ),
          ),
        ),
      ),
      openBuilder: (context, action) => Container(),
    );
  }
}
