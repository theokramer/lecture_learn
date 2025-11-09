import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../shared/Button';
import { TextArea } from '../../shared/Input';
import { HiEye, HiCheck, HiAcademicCap, HiCamera, HiX } from 'react-icons/hi2';
import { openaiService } from '../../../services/openai';
import { studyContentService } from '../../../services/supabase';
import { useAppData } from '../../../context/AppDataContext';
import { useSettings } from '../../../context/SettingsContext';
import { EmptyState } from '../../shared/EmptyState';

interface Exercise {
  question: string;
  solution: string;
  notes: string;
}

interface ExercisesViewProps {
  noteContent: string;
}

export const ExercisesView: React.FC<ExercisesViewProps> = React.memo(function ExercisesView({ noteContent }) {
  const { selectedNoteId } = useAppData();
  const { getPreference } = useSettings();
  const [currentExercise, setCurrentExercise] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [checked, setChecked] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoad = React.useRef(true);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved exercises from Supabase - DO NOT auto-generate, only load from DB
  useEffect(() => {
    const loadSavedExercises = async () => {
      if (!selectedNoteId) return;
      
      try {
        const studyContent = await studyContentService.getStudyContent(selectedNoteId);
        
        if (studyContent.exercises && studyContent.exercises.length > 0) {
          setExercises(studyContent.exercises);
        } else {
          // No saved exercises - set empty array, user can manually generate if needed
          setExercises([]);
        }
      } catch (err) {
        console.error('Error loading saved exercises:', err);
        // On error, just set empty array - don't auto-generate
        setExercises([]);
      } finally {
        setIsLoading(false);
        isInitialLoad.current = false;
      }
    };

    loadSavedExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  // Save exercises to Supabase whenever they change
  const saveExercises = useCallback(async (exercisesToSave: Exercise[]) => {
    if (!selectedNoteId) return;
    
    try {
      await studyContentService.saveStudyContent(selectedNoteId, {
        exercises: exercisesToSave,
      });
    } catch (err) {
      console.error('Error saving exercises:', err);
    }
  }, [selectedNoteId]);

  // Save whenever exercises array changes (but not during initial load)
  // Note: We explicitly save after generation, so this mainly handles user edits
  useEffect(() => {
    if (!isInitialLoad.current && !isGenerating && exercises.length > 0) {
      saveExercises(exercises);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  const generateExercises = async () => {
    if (!noteContent.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    try {
      const count = getPreference('exercisesCount');
      const exerciseList = await openaiService.generateExercise(noteContent, count);
      setExercises(exerciseList);
      
      // Explicitly save after generation
      if (selectedNoteId) {
        await studyContentService.saveStudyContent(selectedNoteId, {
          exercises: exerciseList,
        });
      }
    } catch (error) {
      console.error('Error generating exercises:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate exercises');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCheck = async () => {
    if (!answer.trim() && !uploadedImage) return;
    
    setIsChecking(true);
    setChecked(true);
    setAiFeedback(null);
    
    try {
      const exercise = exercises[currentExercise];
      
      let response: string;
      
      if (uploadedImage) {
        // Analyze image
        response = await openaiService.analyzeExerciseImage(
          uploadedImage,
          exercise.question,
          exercise.solution
        );
      } else {
        // Analyze text answer
        const prompt = `Compare the student's answer with the correct solution and provide constructive feedback.

Exercise Question: ${exercise.question}

Student's Answer:
${answer}

Correct Solution:
${exercise.solution}

Provide feedback in this JSON format:
{
  "score": <number 0-100>,
  "feedback": "<positive, constructive feedback about what they did well and what needs improvement>",
  "isCorrect": <true/false>
}

Be encouraging but honest. If mostly correct, say so. If partially correct, explain what's right and what needs work. If incorrect, gently guide them to the right answer.`;

        response = await openaiService.chatCompletions(
          [{ role: 'user', content: prompt }],
          'You are a helpful teaching assistant that provides constructive feedback on student answers.'
        );
      }
      
      // Parse the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const feedback = JSON.parse(jsonMatch[0]);
          setAiFeedback(feedback.feedback || response);
        } catch (parseError) {
          console.error('Error parsing feedback:', parseError);
          setAiFeedback(response);
        }
      } else {
        setAiFeedback(response);
      }
    } catch (error: any) {
      console.error('Error getting AI feedback:', error);
      if (error?.code === 'ACCOUNT_LIMIT_REACHED') {
        setAiFeedback("You have already used your one-time AI generation quota. No additional AI generations are available.");
      } else if (error?.code === 'DAILY_LIMIT_REACHED') {
        setAiFeedback("Daily AI limit reached. Please try again tomorrow.");
      } else {
      setAiFeedback("I couldn't evaluate your answer at this moment. Please try again or check the solution.");
      }
    } finally {
      setIsChecking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-white text-lg">Loading exercises...</p>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-white text-lg">Generating exercises...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20 space-y-4">
        <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
        <Button onClick={generateExercises}>Retry</Button>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <EmptyState
          icon={HiAcademicCap}
          title="No Exercises Yet"
          description="Generate practice exercises from your note content. Exercises help you apply what you've learned through problem-solving and critical thinking."
          action={{
            label: 'Generate Exercises',
            onClick: generateExercises,
            variant: 'primary',
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Progress */}
      <div className="text-center mb-6">
        <p className="text-white text-lg">
          Exercise {currentExercise + 1} of {exercises.length}
        </p>
      </div>

      {/* Question */}
      <div className="bg-[#2a2a2a] rounded-lg p-8">
        <h2 className="text-2xl font-bold text-white mb-4">
          Exercise {currentExercise + 1}
        </h2>
        <p className="text-white text-lg leading-relaxed">
          {exercises[currentExercise].question}
        </p>
      </div>

      {/* Answer Input */}
      <div className="bg-[#2a2a2a] rounded-lg p-6 space-y-4">
        <TextArea
          label="Your Answer (Text)"
          rows={8}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Write your answer here..."
          className="bg-[#1a1a1a]"
        />
        
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-[#9ca3af] mb-2">
            Or Upload a Photo of Your Work
          </label>
          {!imagePreview ? (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#3a3a3a] rounded-lg cursor-pointer hover:border-[#b85a3a] transition-colors bg-[#1a1a1a]">
              <HiCamera className="w-8 h-8 text-[#9ca3af] mb-2" />
              <p className="text-sm text-[#9ca3af]">Click to upload photo</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Uploaded work"
                className="w-full max-h-64 object-contain rounded-lg border border-[#3a3a3a]"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition-colors"
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button 
          variant="secondary" 
          onClick={handleCheck} 
          disabled={(!answer.trim() && !uploadedImage) || isChecking}
        >
          <HiCheck className="w-5 h-5" />
          {isChecking ? 'Checking...' : 'Check My Work'}
        </Button>
        {/* Only show solution button after getting feedback */}
        {checked && aiFeedback && (
          <Button variant="secondary" onClick={() => setShowSolution(!showSolution)}>
            <HiEye className="w-5 h-5" />
            {showSolution ? 'Hide' : 'Show'} Solution
          </Button>
        )}
      </div>

      {/* AI Feedback */}
      {checked && aiFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-500/20 border border-blue-500 rounded-lg p-4"
        >
          <p className="text-blue-300 whitespace-pre-wrap leading-relaxed">{aiFeedback}</p>
        </motion.div>
      )}

      {/* Solution - Only show after feedback */}
      {checked && showSolution && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-[#1a1a1a] rounded-lg p-6 border border-[#3a3a3a]"
        >
          <h3 className="text-white font-semibold mb-3">Solution:</h3>
          <pre className="text-white whitespace-pre-wrap font-mono text-sm">
            {exercises[currentExercise].solution}
          </pre>
        </motion.div>
      )}

      {/* Navigation */}
      {exercises.length > 1 && (
        <div className="flex justify-between pt-4 pb-4">
          {currentExercise > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                setCurrentExercise(currentExercise - 1);
                setAnswer('');
                setShowSolution(false);
                setChecked(false);
                setAiFeedback(null);
                setUploadedImage(null);
                setImagePreview(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              Previous
            </Button>
          )}
          {currentExercise < exercises.length - 1 && (
            <Button
              onClick={() => {
                setCurrentExercise(currentExercise + 1);
                setAnswer('');
                setShowSolution(false);
                setChecked(false);
                setAiFeedback(null);
                setUploadedImage(null);
                setImagePreview(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              Next Exercise
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
