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

class RecordAudioScreen extends ConsumerStatefulWidget {
  final String? folderId;
  
  const RecordAudioScreen({super.key, this.folderId});

  @override
  ConsumerState<RecordAudioScreen> createState() => _RecordAudioScreenState();
}

class _RecordAudioScreenState extends ConsumerState<RecordAudioScreen> {
  final AudioRecorder _recorder = AudioRecorder();
  bool _isRecording = false;
  Duration _duration = Duration.zero;
  Timer? _timer;
  String? _audioPath;

  @override
  void dispose() {
    _timer?.cancel();
    _recorder.dispose();
    super.dispose();
  }

  Future<void> _startRecording() async {
    try {
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
        // Use WAV format (PCM16) for maximum compatibility with OpenAI Whisper
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

    print('Processing recording: ${file.path}, size: $fileSize bytes');

    try {
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
      if (mounted) {
        showCupertinoDialog(
          context: context,
          builder: (context) => CupertinoAlertDialog(
            title: const Text('Error'),
            content: Text('Failed to process recording: $e'),
          ),
        );
      }
    }
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}';
    }
    return '${twoDigits(minutes)}:${twoDigits(seconds)}';
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
          'Voice Recording',
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
              const Text(
                'Voice Recording',
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Record your voice note',
                style: TextStyle(
                  fontSize: 17,
                  color: Color(0xFF9CA3AF),
                  fontWeight: FontWeight.w400,
                ),
              ),
              const SizedBox(height: 60),
              // Timer
              Text(
                _formatDuration(_duration),
                style: const TextStyle(
                  fontSize: 76,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -2,
                ),
              ),
              const SizedBox(height: 60),
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
                    color: _isRecording ? const Color(0xFFEF4444) : const Color(0xFFB85A3A),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: (_isRecording ? const Color(0xFFEF4444) : const Color(0xFFB85A3A)).withOpacity(0.4),
                        blurRadius: 20,
                        spreadRadius: 4,
                      ),
                    ],
                  ),
                  child: Icon(
                    _isRecording ? CupertinoIcons.stop_fill : CupertinoIcons.mic_fill,
                    color: const Color(0xFFFFFFFF),
                    size: 48,
                  ),
                ),
              ),
              const SizedBox(height: 60),
              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: CupertinoButton(
                      onPressed: () {
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
                      onPressed: _audioPath != null
                          ? () {
                              HapticFeedback.mediumImpact();
                              _processRecording();
                            }
                          : null,
                      color: const Color(0xFFB85A3A),
                      disabledColor: const Color(0xFF3A3A3A),
                      borderRadius: BorderRadius.circular(14),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: const Text(
                        'Done',
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

