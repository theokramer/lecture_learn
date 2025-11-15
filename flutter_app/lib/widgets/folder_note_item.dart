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
            color: const Color(0xFF252525),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 12,
                offset: const Offset(0, 4),
                spreadRadius: 0,
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2F2F2F),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    isFolder ? CupertinoIcons.folder_fill : CupertinoIcons.doc_text_fill,
                    color: const Color(0xFFFFFFFF),
                    size: 26,
                  ),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Color(0xFFFFFFFF),
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.3,
                          height: 1.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (date != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(
                              CupertinoIcons.calendar,
                              size: 13,
                              color: const Color(0xFF8E8E93).withOpacity(0.9),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              DateFormat('MMM d, yyyy').format(date),
                              style: TextStyle(
                                color: const Color(0xFF8E8E93).withOpacity(0.9),
                                fontSize: 14,
                                fontWeight: FontWeight.w400,
                                letterSpacing: -0.2,
                              ),
                            ),
                          ],
                        ),
                      ] else if (isFolder) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Folder',
                          style: TextStyle(
                            color: const Color(0xFF8E8E93).withOpacity(0.7),
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                            letterSpacing: -0.2,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Icon(
                  CupertinoIcons.chevron_right,
                  color: const Color(0xFF8E8E93).withOpacity(0.4),
                  size: 16,
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
