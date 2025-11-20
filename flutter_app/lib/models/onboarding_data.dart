/// Model to store user onboarding responses
class OnboardingData {
  final String? studentStatus;
  final List<String>? studyProblems; // Changed to list for multi-select
  final List<String>? learningStyles; // Changed to list for multi-select
  final String? difficultFormat;
  final String? reviewStruggle;
  final String? stuckStrategy;
  final String? examReadiness;
  final String? engagementImportance;
  final String? stressfulSubject;
  final int? hoursPerWeek;
  final int? dailyTimeCommitment;
  final String? academicGoal;
  final List<String>? extraTimeUsage; // Changed to list for multi-select
  final String? freeTimeFeeling;
  
  // Legacy single-select fields (for backward compatibility)
  final String? learningStyle;
  final String? studyProblem;
  final String? extraTimeUsageSingle;

  OnboardingData({
    this.studentStatus,
    this.studyProblems,
    this.learningStyles,
    this.difficultFormat,
    this.reviewStruggle,
    this.stuckStrategy,
    this.examReadiness,
    this.engagementImportance,
    this.stressfulSubject,
    this.hoursPerWeek,
    this.dailyTimeCommitment,
    this.academicGoal,
    this.extraTimeUsage,
    this.freeTimeFeeling,
    // Legacy fields
    this.learningStyle,
    this.studyProblem,
    this.extraTimeUsageSingle,
  });

  Map<String, dynamic> toJson() {
    return {
      'studentStatus': studentStatus,
      'studyProblems': studyProblems,
      'learningStyles': learningStyles,
      'difficultFormat': difficultFormat,
      'reviewStruggle': reviewStruggle,
      'stuckStrategy': stuckStrategy,
      'examReadiness': examReadiness,
      'engagementImportance': engagementImportance,
      'stressfulSubject': stressfulSubject,
      'hoursPerWeek': hoursPerWeek,
      'dailyTimeCommitment': dailyTimeCommitment,
      'academicGoal': academicGoal,
      'extraTimeUsage': extraTimeUsage,
      'freeTimeFeeling': freeTimeFeeling,
      // Legacy fields for backward compatibility
      'learningStyle': learningStyle ?? (learningStyles?.isNotEmpty == true ? learningStyles!.first : null),
      'studyProblem': studyProblem ?? (studyProblems?.isNotEmpty == true ? studyProblems!.first : null),
      'extraTimeUsageSingle': extraTimeUsageSingle ?? (extraTimeUsage?.isNotEmpty == true ? extraTimeUsage!.first : null),
    };
  }

  OnboardingData copyWith({
    String? studentStatus,
    List<String>? studyProblems,
    List<String>? learningStyles,
    String? difficultFormat,
    String? reviewStruggle,
    String? stuckStrategy,
    String? examReadiness,
    String? engagementImportance,
    String? stressfulSubject,
    int? hoursPerWeek,
    int? dailyTimeCommitment,
    String? academicGoal,
    List<String>? extraTimeUsage,
    String? freeTimeFeeling,
    // Legacy fields
    String? learningStyle,
    String? studyProblem,
    String? extraTimeUsageSingle,
  }) {
    return OnboardingData(
      studentStatus: studentStatus ?? this.studentStatus,
      studyProblems: studyProblems ?? this.studyProblems,
      learningStyles: learningStyles ?? this.learningStyles,
      difficultFormat: difficultFormat ?? this.difficultFormat,
      reviewStruggle: reviewStruggle ?? this.reviewStruggle,
      stuckStrategy: stuckStrategy ?? this.stuckStrategy,
      examReadiness: examReadiness ?? this.examReadiness,
      engagementImportance: engagementImportance ?? this.engagementImportance,
      stressfulSubject: stressfulSubject ?? this.stressfulSubject,
      hoursPerWeek: hoursPerWeek ?? this.hoursPerWeek,
      dailyTimeCommitment: dailyTimeCommitment ?? this.dailyTimeCommitment,
      academicGoal: academicGoal ?? this.academicGoal,
      extraTimeUsage: extraTimeUsage ?? this.extraTimeUsage,
      freeTimeFeeling: freeTimeFeeling ?? this.freeTimeFeeling,
      // Legacy fields
      learningStyle: learningStyle ?? this.learningStyle,
      studyProblem: studyProblem ?? this.studyProblem,
      extraTimeUsageSingle: extraTimeUsageSingle ?? this.extraTimeUsageSingle,
    );
  }
}

