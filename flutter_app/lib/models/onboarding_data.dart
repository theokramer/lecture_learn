/// Model to store user onboarding responses
class OnboardingData {
  final String? studentStatus;
  final String? learningStyle;
  final String? difficultFormat;
  final String? studyProblem;
  final String? reviewStruggle;
  final String? stuckStrategy;
  final String? examReadiness;
  final String? engagementImportance;
  final String? stressfulSubject;
  final int? hoursPerWeek;
  final int? dailyTimeCommitment;
  final String? academicGoal;
  final String? extraTimeUsage;
  final String? freeTimeFeeling;

  OnboardingData({
    this.studentStatus,
    this.learningStyle,
    this.difficultFormat,
    this.studyProblem,
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
  });

  Map<String, dynamic> toJson() {
    return {
      'studentStatus': studentStatus,
      'learningStyle': learningStyle,
      'difficultFormat': difficultFormat,
      'studyProblem': studyProblem,
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
    };
  }

  OnboardingData copyWith({
    String? studentStatus,
    String? learningStyle,
    String? difficultFormat,
    String? studyProblem,
    String? reviewStruggle,
    String? stuckStrategy,
    String? examReadiness,
    String? engagementImportance,
    String? stressfulSubject,
    int? hoursPerWeek,
    int? dailyTimeCommitment,
    String? academicGoal,
    String? extraTimeUsage,
    String? freeTimeFeeling,
  }) {
    return OnboardingData(
      studentStatus: studentStatus ?? this.studentStatus,
      learningStyle: learningStyle ?? this.learningStyle,
      difficultFormat: difficultFormat ?? this.difficultFormat,
      studyProblem: studyProblem ?? this.studyProblem,
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
    );
  }
}

