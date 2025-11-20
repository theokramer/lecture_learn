import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/revenuecat_provider.dart';
import '../services/settings_service.dart';
import '../utils/logger.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  int _flashcardCount = 20;
  int _quizCount = 15;
  int _exerciseCount = 10;
  int _feynmanTopicCount = 4;
  bool _autoGenerate = true;
  bool _hapticFeedback = true;
  bool _soundEffects = true;
  String _appVersion = '1.0.0';
  String _buildNumber = '1';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _loadAppInfo();
  }

  Future<void> _loadSettings() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final flashcardCount = await SettingsService.getFlashcardCount();
      final quizCount = await SettingsService.getQuizCount();
      final exerciseCount = await SettingsService.getExerciseCount();
      final feynmanTopicCount = await SettingsService.getFeynmanTopicCount();
      final autoGenerate = await SettingsService.getAutoGenerate();
      final hapticFeedback = await SettingsService.getHapticFeedback();
      final soundEffects = await SettingsService.getSoundEffects();

      setState(() {
        _flashcardCount = flashcardCount;
        _quizCount = quizCount;
        _exerciseCount = exerciseCount;
        _feynmanTopicCount = feynmanTopicCount;
        _autoGenerate = autoGenerate;
        _hapticFeedback = hapticFeedback;
        _soundEffects = soundEffects;
        _isLoading = false;
      });
    } catch (e) {
      AppLogger.error('Error loading settings', error: e, tag: 'SettingsScreen');
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _loadAppInfo() async {
    // Version info will be loaded after package_info_plus is installed
    // For now, use default values
    setState(() {
      _appVersion = '1.0.0';
      _buildNumber = '1';
    });
  }


  void _showCountPicker({
    required String title,
    required int currentValue,
    required int min,
    required int max,
    required Function(int) onChanged,
  }) {
    showCupertinoModalPopup(
      context: context,
      builder: (context) {
        int selectedValue = currentValue;
        return StatefulBuilder(
          builder: (context, setState) => Container(
            height: 250,
            decoration: const BoxDecoration(
              color: Color(0xFF2A2A2A),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: const BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: Color(0xFF3A3A3A), width: 0.5),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      CupertinoButton(
                        padding: EdgeInsets.zero,
                        minSize: 0,
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(color: Color(0xFF9CA3AF)),
                        ),
                      ),
                      Text(
                        title,
                        style: const TextStyle(
                          color: Color(0xFFFFFFFF),
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      CupertinoButton(
                        padding: EdgeInsets.zero,
                        minSize: 0,
                        onPressed: () {
                          Navigator.of(context).pop();
                          onChanged(selectedValue);
                        },
                        child: const Text(
                          'Done',
                          style: TextStyle(color: Color(0xFFFFFFFF)),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: CupertinoPicker(
                    scrollController: FixedExtentScrollController(
                      initialItem: currentValue - min,
                    ),
                    itemExtent: 40,
                    onSelectedItemChanged: (index) {
                      setState(() {
                        selectedValue = min + index;
                      });
                    },
                    children: List.generate(
                      max - min + 1,
                      (index) => Center(
                        child: Text(
                          '${min + index}',
                          style: const TextStyle(
                            color: Color(0xFFFFFFFF),
                            fontSize: 20,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _formatDate(dynamic date) {
    if (date == null) return 'N/A';
    if (date is DateTime) {
      return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    } else if (date is String) {
      try {
        final parsed = DateTime.parse(date);
        return '${parsed.year}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
      } catch (e) {
        return date.toString();
      }
    }
    return date.toString();
  }

  @override
  Widget build(BuildContext context) {
    final revenueCatState = ref.watch(revenueCatProvider);
    final hasPremium = revenueCatState.hasActiveSubscription;
    final customerInfo = revenueCatState.customerInfo;
    
    // Get renewal date from active entitlements
    dynamic renewalDate;
    if (customerInfo != null && customerInfo.entitlements.active.isNotEmpty) {
      final entitlement = customerInfo.entitlements.active.values.first;
      renewalDate = entitlement.expirationDate;
    }

    if (_isLoading) {
      return CupertinoPageScaffold(
        backgroundColor: const Color(0xFF1A1A1A),
        navigationBar: const CupertinoNavigationBar(
          backgroundColor: Color(0xFF2A2A2A),
          middle: Text(
            'Settings',
            style: TextStyle(
              color: Color(0xFFFFFFFF),
              fontSize: 17,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        child: const Center(
          child: CupertinoActivityIndicator(),
        ),
      );
    }

    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      navigationBar: const CupertinoNavigationBar(
        backgroundColor: Color(0xFF2A2A2A),
        middle: Text(
          'Settings',
          style: TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      child: SafeArea(
        child: ListView(
          children: [
            // Premium Status Section
            _buildSection(
              title: 'Premium',
              children: [
                _buildInfoRow(
                  title: 'Premium Status',
                  value: hasPremium ? 'Active' : 'Not Active',
                  icon: hasPremium ? CupertinoIcons.star_fill : CupertinoIcons.star,
                ),
                if (hasPremium && renewalDate != null)
                  _buildInfoRow(
                    title: 'Renewal Date',
                    value: _formatDate(renewalDate),
                    icon: CupertinoIcons.calendar,
                  ),
              ],
            ),

            // Study Preferences
            _buildSection(
              title: 'Study Preferences',
              children: [
                _buildCountRow(
                  title: 'Flashcards per note',
                  value: _flashcardCount,
                  onTap: () {
                    _showCountPicker(
                      title: 'Flashcards per note',
                      currentValue: _flashcardCount,
                      min: 5,
                      max: 50,
                      onChanged: (value) async {
                        setState(() => _flashcardCount = value);
                        await SettingsService.setFlashcardCount(value);
                        HapticFeedback.selectionClick();
                      },
                    );
                  },
                ),
                _buildCountRow(
                  title: 'Quiz questions per note',
                  value: _quizCount,
                  onTap: () {
                    _showCountPicker(
                      title: 'Quiz questions per note',
                      currentValue: _quizCount,
                      min: 5,
                      max: 30,
                      onChanged: (value) async {
                        setState(() => _quizCount = value);
                        await SettingsService.setQuizCount(value);
                        HapticFeedback.selectionClick();
                      },
                    );
                  },
                ),
                _buildCountRow(
                  title: 'Exercises per note',
                  value: _exerciseCount,
                  onTap: () {
                    _showCountPicker(
                      title: 'Exercises per note',
                      currentValue: _exerciseCount,
                      min: 5,
                      max: 20,
                      onChanged: (value) async {
                        setState(() => _exerciseCount = value);
                        await SettingsService.setExerciseCount(value);
                        HapticFeedback.selectionClick();
                      },
                    );
                  },
                ),
                _buildCountRow(
                  title: 'Feynman topics per note',
                  value: _feynmanTopicCount,
                  onTap: () {
                    _showCountPicker(
                      title: 'Feynman topics per note',
                      currentValue: _feynmanTopicCount,
                      min: 2,
                      max: 10,
                      onChanged: (value) async {
                        setState(() => _feynmanTopicCount = value);
                        await SettingsService.setFeynmanTopicCount(value);
                        HapticFeedback.selectionClick();
                      },
                    );
                  },
                ),
              ],
            ),

            // App Preferences
            _buildSection(
              title: 'App Preferences',
              children: [
                _buildSwitchRow(
                  title: 'Auto-generate content',
                  subtitle: 'Automatically generate study content when creating notes',
                  value: _autoGenerate,
                  onChanged: (value) async {
                    setState(() => _autoGenerate = value);
                    await SettingsService.setAutoGenerate(value);
                    HapticFeedback.selectionClick();
                  },
                ),
                _buildSwitchRow(
                  title: 'Haptic feedback',
                  subtitle: 'Vibrate on button taps',
                  value: _hapticFeedback,
                  onChanged: (value) async {
                    setState(() => _hapticFeedback = value);
                    await SettingsService.setHapticFeedback(value);
                    HapticFeedback.selectionClick();
                  },
                ),
                _buildSwitchRow(
                  title: 'Sound effects',
                  subtitle: 'Play sounds for actions',
                  value: _soundEffects,
                  onChanged: (value) async {
                    setState(() => _soundEffects = value);
                    await SettingsService.setSoundEffects(value);
                    HapticFeedback.selectionClick();
                  },
                ),
              ],
            ),

            // About Section
            _buildSection(
              title: 'About',
              children: [
                _buildInfoRow(
                  title: 'Version',
                  value: '$_appVersion ($_buildNumber)',
                  icon: CupertinoIcons.info_circle,
                ),
                _buildActionRow(
                  title: 'Privacy Policy',
                  icon: CupertinoIcons.doc_text,
                  onTap: () async {
                    final url = Uri.parse('https://sites.google.com/view/rocket-learn/privacy-policy');
                    if (await canLaunchUrl(url)) {
                      await launchUrl(url, mode: LaunchMode.externalApplication);
                    }
                  },
                ),
                _buildActionRow(
                  title: 'Terms of Service',
                  icon: CupertinoIcons.doc_text_fill,
                  onTap: () async {
                    final url = Uri.parse('https://sites.google.com/view/rocket-learn/terms-of-service');
                    if (await canLaunchUrl(url)) {
                      await launchUrl(url, mode: LaunchMode.externalApplication);
                    }
                  },
                ),
                _buildActionRow(
                  title: 'Support',
                  icon: CupertinoIcons.question_circle,
                  onTap: () async {
                    final url = Uri.parse('https://sites.google.com/view/rocket-learn/support');
                    if (await canLaunchUrl(url)) {
                      await launchUrl(url, mode: LaunchMode.externalApplication);
                    }
                  },
                ),
              ],
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFF9CA3AF),
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF2A2A2A),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: children,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow({
    required String title,
    required String value,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFF3A3A3A), width: 0.5),
        ),
      ),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF9CA3AF), size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Color(0xFF9CA3AF),
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    color: Color(0xFFFFFFFF),
                    fontSize: 17,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCountRow({
    required String title,
    required int value,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Color(0xFF3A3A3A), width: 0.5),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 17,
                ),
              ),
            ),
            Text(
              '$value',
              style: const TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 17,
              ),
            ),
            const SizedBox(width: 8),
            const Icon(
              CupertinoIcons.chevron_right,
              color: Color(0xFF9CA3AF),
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchRow({
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFF3A3A3A), width: 0.5),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Color(0xFFFFFFFF),
                    fontSize: 17,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Color(0xFF9CA3AF),
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
          CupertinoSwitch(
            value: value,
            onChanged: onChanged,
            activeColor: const Color(0xFF8D1647),
          ),
        ],
      ),
    );
  }

  Widget _buildActionRow({
    required String title,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Color(0xFF3A3A3A), width: 0.5),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFF9CA3AF), size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 17,
                ),
              ),
            ),
            const Icon(
              CupertinoIcons.chevron_right,
              color: Color(0xFF9CA3AF),
              size: 16,
            ),
          ],
        ),
      ),
    );
  }
}

