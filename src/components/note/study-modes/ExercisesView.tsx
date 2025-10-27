import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../shared/Button';
import { TextArea } from '../../shared/Input';
import { HiEye, HiCheck } from 'react-icons/hi2';

export const ExercisesView: React.FC = () => {
  const [currentExercise, setCurrentExercise] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [checked, setChecked] = useState(false);

  const exercises = [
    {
      question: 'Explain the concept of closures in JavaScript with an example.',
      solution: 'A closure is a function that has access to variables in its outer (enclosing) lexical scope, even after the outer function has returned. Example: \n\nfunction outer() {\n  let count = 0;\n  return function inner() {\n    count++;\n    return count;\n  };\n}\n\nconst increment = outer();\nconsole.log(increment()); // 1\nconsole.log(increment()); // 2',
      notes: 'Great job! You explained closures well. Remember that closures allow functions to "remember" their lexical environment.',
    },
    {
      question: 'Explain how React\'s component lifecycle works.',
      solution: 'React components go through several lifecycle phases: 1) Mounting (component is created and inserted into DOM), 2) Updating (component re-renders due to state or prop changes), 3) Unmounting (component is removed from DOM). Use useEffect hook to handle side effects.',
      notes: 'Good understanding of React lifecycle. Keep in mind that useEffect replaces componentDidMount, componentDidUpdate, and componentWillUnmount.',
    },
  ];

  const handleCheck = () => {
    setChecked(true);
    setTimeout(() => setChecked(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
      <div className="bg-[#2a2a2a] rounded-lg p-6">
        <TextArea
          label="Your Answer"
          rows={12}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Write your answer here..."
          className="bg-[#1a1a1a]"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button variant="secondary" onClick={handleCheck} disabled={!answer.trim()}>
          <HiCheck className="w-5 h-5" />
          Check My Work
        </Button>
        <Button variant="secondary" onClick={() => setShowSolution(!showSolution)}>
          <HiEye className="w-5 h-5" />
          {showSolution ? 'Hide' : 'Show'} Solution
        </Button>
      </div>

      {/* Check Feedback */}
      {checked && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/20 border border-green-500 rounded-lg p-4"
        >
          <p className="text-green-500">{exercises[currentExercise].notes}</p>
        </motion.div>
      )}

      {/* Solution */}
      {showSolution && (
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
      <div className="flex justify-between pt-4">
        <Button
          variant="secondary"
          onClick={() => {
            if (currentExercise > 0) {
              setCurrentExercise(currentExercise - 1);
              setAnswer('');
              setShowSolution(false);
            }
          }}
          disabled={currentExercise === 0}
        >
          Previous
        </Button>
        <Button
          onClick={() => {
            if (currentExercise < exercises.length - 1) {
              setCurrentExercise(currentExercise + 1);
              setAnswer('');
              setShowSolution(false);
            }
          }}
          disabled={currentExercise === exercises.length - 1}
        >
          Next Exercise
        </Button>
      </div>
    </div>
  );
};
