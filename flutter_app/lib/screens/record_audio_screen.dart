import 'dart:async';
import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../utils/logger.dart';
import '../utils/error_handler.dart';
import '../providers/app_data_provider.dart';
import '../widgets/free_notes_limit_widget.dart';

class RecordAudioScreen extends ConsumerStatefulWidget {
  final String? folderId;
  
  const RecordAudioScreen({super.key, this.folderId});

  @override
  ConsumerState<RecordAudioScreen> createState() => _RecordAudioScreenState();
}

class _RecordAudioScreenState extends ConsumerState<RecordAudioScreen> with TickerProviderStateMixin {
  final AudioRecorder _recorder = AudioRecorder();
  bool _isRecording = false;
  Duration _duration = Duration.zero;
  Timer? _timer;
  String? _audioPath;
  late List<AnimationController> _waveControllers;

  @override
  void initState() {
    super.initState();
    // Initialize 20 animation controllers for the waveform with staggered delays
    _waveControllers = List.generate(
      20,
      (index) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 500),
      ),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    _recorder.dispose();
    for (var controller in _waveControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _startRecording() async {
    try {
      // Check note creation limit FIRST, before any recording starts
      final appData = ref.read(appDataProvider.notifier);
      try {
        final canCreate = await appData.canCreateNoteWithStudyContent();
        if (!canCreate) {
          // This shouldn't happen as exception is thrown, but handle it anyway
          if (mounted) {
            _showLimitReachedScreen();
          }
          return;
        }
      } catch (e) {
        if (e is NoteCreationLimitException) {
          if (mounted) {
            _showLimitReachedScreen();
          }
          return;
        }
        // For other errors, log and continue (might be network issues)
        AppLogger.error('Error checking note creation limit', error: e, tag: 'RecordAudioScreen');
      }

      // Check if running on iOS Simulator
      if (Platform.isIOS && !kIsWeb) {
        // Check if running on simulator
        final isSimulator = await _isSimulator();
        if (isSimulator) {
          if (mounted) {
            showCupertinoDialog(
              context: context,
              builder: (context) => CupertinoAlertDialog(
                title: const Text('Simulator Not Supported'),
                content: const Text(
                  'Audio recording is not available on iOS Simulator. '
                  'Please test on a physical device to record audio.',
                ),
                actions: [
                  CupertinoDialogAction(
                    child: const Text('OK'),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            );
          }
          return;
        }
      }

      if (await _recorder.hasPermission()) {
        final directory = await getApplicationDocumentsDirectory();
        // Use WAV format (PCM16) for maximum compatibility with transcription service
        // This matches the website's approach of using well-supported formats
        final path = '${directory.path}/recording_${DateTime.now().millisecondsSinceEpoch}.wav';
        
        await _recorder.start(
          const RecordConfig(
            encoder: AudioEncoder.pcm16bits, // WAV format - universally supported
            sampleRate: 48000, // Match website's sample rate
            numChannels: 1, // Mono - matches website and reduces file size
          ),
          path: path,
        );

        setState(() {
          _isRecording = true;
          _duration = Duration.zero;
          _audioPath = path;
        });

        // Start waveform animations with staggered delays
        for (int i = 0; i < _waveControllers.length; i++) {
          Future.delayed(Duration(milliseconds: i * 25), () {
            if (mounted && _isRecording) {
              _waveControllers[i].repeat(reverse: true);
            }
          });
        }

        _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
          setState(() {
            _duration = Duration(seconds: _duration.inSeconds + 1);
          });
        });
      } else {
        if (mounted) {
          showCupertinoDialog(
            context: context,
            builder: (context) => CupertinoAlertDialog(
              title: const Text('Permission Required'),
              content: const Text('Please grant microphone permission to record audio.'),
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
    } catch (e) {
      if (mounted) {
        final errorMessage = e.toString().toLowerCase();
        final isSimulatorError = errorMessage.contains('simulator') ||
                                 errorMessage.contains('not available') ||
                                 errorMessage.contains('hardware');
        
        showCupertinoDialog(
          context: context,
          builder: (context) => CupertinoAlertDialog(
            title: const Text('Error'),
            content: Text(
              isSimulatorError
                  ? 'Audio recording is not available on iOS Simulator. '
                      'Please test on a physical device to record audio.'
                  : 'Failed to start recording: $e',
            ),
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

  Future<bool> _isSimulator() async {
    if (!Platform.isIOS) return false;
    try {
      final deviceInfo = DeviceInfoPlugin();
      final iosInfo = await deviceInfo.iosInfo;
      // Simulators have specific model identifiers
      return iosInfo.model.toLowerCase().contains('simulator') ||
             iosInfo.name.toLowerCase().contains('simulator');
    } catch (e) {
      // If we can't determine, assume it's not a simulator
      return false;
    }
  }

  Future<void> _stopRecording() async {
    _timer?.cancel();
    final path = await _recorder.stop();
    
    // Stop waveform animations
    for (var controller in _waveControllers) {
      controller.stop();
      controller.reset();
    }
    
    setState(() {
      _isRecording = false;
      if (path != null) {
        _audioPath = path;
      }
    });
  }

  Future<void> _processRecording() async {
    if (_audioPath == null) return;

    final file = File(_audioPath!);
    if (!await file.exists()) {
      if (mounted) {
        showCupertinoDialog(
          context: context,
          builder: (context) => const CupertinoAlertDialog(
            title: Text('Error'),
            content: Text('Audio file not found. Please try recording again.'),
          ),
        );
      }
      return;
    }

    // Validate file size
    final fileSize = await file.length();
    if (fileSize == 0) {
      if (mounted) {
        showCupertinoDialog(
          context: context,
          builder: (context) => const CupertinoAlertDialog(
            title: Text('Error'),
            content: Text('Audio file is empty. Please try recording again.'),
          ),
        );
      }
      return;
    }

    AppLogger.debug('Processing recording: ${file.path}, size: $fileSize bytes', tag: 'RecordAudioScreen');

    try {
      // Check if user can create notes with study content BEFORE navigating
      final appData = ref.read(appDataProvider.notifier);
      try {
        final canCreate = await appData.canCreateNoteWithStudyContent();
        if (!canCreate) {
          // This shouldn't happen as exception is thrown, but handle it anyway
          if (mounted) {
            _showLimitReachedScreen();
          }
          return;
        }
      } catch (e) {
        if (e is NoteCreationLimitException) {
          if (mounted) {
            _showLimitReachedScreen();
          }
          return;
        }
        rethrow;
      }

      // Navigate to processing screen
      if (mounted) {
        final path = widget.folderId != null 
            ? '/note-creation/processing?folderId=${widget.folderId}'
            : '/note-creation/processing';
        context.push(path, extra: {
          'audioFile': file,
          'title': 'Voice Recording',
        });
      }
    } catch (e) {
      ErrorHandler.logError(e, context: 'Processing recording', tag: 'RecordAudioScreen');
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

  void _showLimitReachedScreen() {
    showCupertinoModalPopup(
      context: context,
      builder: (context) => FreeNotesLimitWidget(
        onDismiss: () {
          if (mounted) {
            Navigator.of(context).pop(); // Dismiss current dialog
          }
        },
      ),
    );
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    // Always show hours:minutes:seconds format
    return '${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}';
  }

  Widget _buildCircularAnimation() {
    return SizedBox(
      height: 330,
      width: double.infinity,
      child: Image.asset(
        'assets/images/Wave Animation.gif',
        fit: BoxFit.contain,
        width: double.infinity,
        height: 400,
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
        leading: CupertinoNavigationBarBackButton(
          onPressed: () => context.pop(),
          color: const Color(0xFFFFFFFF),
        ),
        middle: const Text(
          'Live Recording',
          style: TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(flex: 2),
              // Circular Animation
              _buildCircularAnimation(),
              const Spacer(flex: 6),
              // Divider
              Container(
                height: 1,
                width: double.infinity,
                margin: const EdgeInsets.symmetric(horizontal: 40),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      const Color(0xFF3A3A3A).withOpacity(0.5),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
              const Spacer(flex: 3),
              // Timer
              Text(
                _formatDuration(_duration),
                style: const TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -0.5,
                  height: 1.0,
                ),
              ),
              const SizedBox(height: 22),
              // Record Button
              GestureDetector(
                onTap: () {
                  HapticFeedback.mediumImpact();
                  if (_isRecording) {
                    _stopRecording();
                  } else {
                    _startRecording();
                  }
                },
                child: Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: Colors.transparent,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFFFFFFF),
                      width: 3,
                    ),
                  ),
                  child: _isRecording
                      ? Container(
                          margin: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFFFF), // Purple square
                            borderRadius: BorderRadius.circular(8),
                          ),
                        )
                      : const Center(
                          child: Padding(
                            padding: EdgeInsets.only(left: 2),
                            child: Icon(
                              CupertinoIcons.play_fill,
                              color: Color(0xFFFFFFFF),
                              size: 48,
                            ),
                          ),
                        ),
                ),
              ),
              const Spacer(flex: 2),
              // Action Button
              SizedBox(
                width: double.infinity,
                child: CupertinoButton.filled(
                  onPressed: _audioPath != null
                      ? () {
                          HapticFeedback.mediumImpact();
                          _processRecording();
                        }
                      : null,
                  color: const Color(0xFFFFFFFF),
                  disabledColor: const Color(0xFF3A3A3A),
                  borderRadius: BorderRadius.circular(14),
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Text(
                    'Generate Notes',
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w600,
                      color: _audioPath != null
                          ? const Color(0xFF1A1A1A)
                          : const Color(0xFF9CA3AF),
                    ),
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

