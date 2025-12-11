import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { lessonAPI } from '../lib/api'
import { Play, BookOpen, CheckCircle, ArrowRight, Clock, Target, Award, XCircle, AlertCircle, BookOpenText } from 'lucide-react'
import { useState, useEffect } from 'react'
import confetti from 'canvas-confetti'

const LessonView = () => {
  const { dayId } = useParams()
  const navigate = useNavigate()
  const { learningPath, refreshProfile, user } = useApp()
  const [activeTab, setActiveTab] = useState('video')
  const [apiLessonData, setApiLessonData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const speakWord = (text) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }

  // Quiz State
  const [userAnswers, setUserAnswers] = useState({}) // { exerciseId: selectedOption }
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [showFeedback, setShowFeedback] = useState(null) // 'success' or 'error'

  const [completedSections, setCompletedSections] = useState({
    video: false,
    vocabulary: false,
    grammar: false,
    reading: false,
    exercises: false
  })

  const tabs = [
    { id: 'video', label: 'الفيديو', icon: Play },
    { id: 'vocabulary', label: 'المفردات', icon: BookOpen },
    { id: 'grammar', label: 'القواعد', icon: Target },
    { id: 'reading', label: 'القراءة', icon: BookOpenText },
    { id: 'exercises', label: 'الاختبار', icon: CheckCircle }
  ]

  const getOptions = (ex) => {
    if (!ex.options) return null;
    return typeof ex.options === 'string' ? JSON.parse(ex.options) : ex.options;
  };

  // Helper to detect if exercise is multiple choice (check options first, then type)
  const isMultipleChoice = (ex) => {
    const options = getOptions(ex);
    // If options exist and have values, it's multiple choice
    if (options && Array.isArray(options) && options.length > 0) {
      return true;
    }
    // Fallback to type check
    return ex.type === 'multiple-choice';
  };

  const checkIsCorrect = (ex, userAnswer) => {
    if (userAnswer === undefined || userAnswer === null || userAnswer === '') return false;

    const correctAnswer = ex.correctAnswer !== undefined ? ex.correctAnswer : ex.correct_answer;

    // Multiple Choice: correctAnswer is an index (number)
    if (isMultipleChoice(ex)) {
      const options = getOptions(ex);
      if (!options || !Array.isArray(options)) return false;

      const selectedIndex = options.indexOf(userAnswer);
      // Check if the selected option's index matches the correct answer index
      return selectedIndex !== -1 && selectedIndex == correctAnswer;
    }

    // Fill-blank & Translate: correctAnswer is a string - text comparison
    const normalizedUser = String(userAnswer).trim().toLowerCase();
    const normalizedCorrect = String(correctAnswer).trim().toLowerCase();
    return normalizedUser === normalizedCorrect;
  };



  // Helper to get exercise type (detect from options if type is missing)
  const getExerciseType = (ex) => {
    if (ex.type) return ex.type;
    const options = getOptions(ex);
    if (options && Array.isArray(options) && options.length > 0) {
      return 'multiple-choice';
    }
    // Check question content to guess type
    const q = (ex.question || '').toLowerCase();
    if (q.includes('ترجم') || q.includes('translate')) return 'translate';
    if (q.includes('complete') || q.includes('أكمل') || q.includes('___')) return 'fill-blank';
    return 'fill-blank'; // default
  };

  // Helper to get question type label in Arabic
  const getQuestionTypeLabel = (ex) => {
    const type = getExerciseType(ex);
    switch (type) {
      case 'multiple-choice': return 'اختر الإجابة الصحيحة';
      case 'fill-blank': return 'أكمل الفراغ';
      case 'translate': return 'ترجم';
      default: return 'سؤال';
    }
  };

  // Helper to get placeholder text based on question type
  const getPlaceholder = (ex) => {
    const type = getExerciseType(ex);
    switch (type) {
      case 'fill-blank': return 'أكتب الكلمة الناقصة...';
      case 'translate': return 'أكتب الترجمة هنا...';
      default: return 'أكتب إجابتك هنا...';
    }
  };

  // 1. Get local rich content
  const localLesson = learningPath.find(l => l.day === parseInt(dayId))

  // 2. Merge with API data - ALWAYS use local exercises (they have complete type/options)
  const lesson = localLesson ? {
    ...localLesson,
    ...apiLessonData,
    exercises: localLesson.exercises  // Always use local - has options/type fields
  } : null

  // Helper for localStorage key
  const getStorageKey = () => user ? `lesson_progress_${user.id}_${dayId}` : null;

  useEffect(() => {
    const fetchLessonData = async () => {
      try {
        const { data } = await lessonAPI.getLesson(dayId);
        setApiLessonData(data);

        let initialAnswers = {};

        // Check if lesson is already completed first
        if (data.userProgress?.completed) {
          // Lesson completed - show results state but DON'T load old answers
          setCompletedSections({
            video: true,
            vocabulary: true,
            grammar: true,
            reading: true,
            exercises: true
          });
          setQuizSubmitted(true);
          if (data.userProgress?.score !== undefined) {
            setScore(data.userProgress.score);
          }
          // Keep initialAnswers empty - user can retake fresh
        } else {
          // Lesson NOT completed - load saved progress to continue

          // 1. Load from DB
          if (data.userProgress?.saved_answers) {
            initialAnswers = { ...data.userProgress.saved_answers };
          }

          // 2. Load from LocalStorage (backup)
          const storageKey = getStorageKey();
          if (storageKey) {
            const savedLocal = localStorage.getItem(storageKey);
            if (savedLocal) {
              try {
                const parsed = JSON.parse(savedLocal);
                initialAnswers = { ...initialAnswers, ...parsed };
              } catch (e) {
                console.error("Failed to parse local storage", e);
              }
            }
          }
        }

        setUserAnswers(initialAnswers);
      } catch (error) {
        console.error("Error fetching lesson:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if has user (to generate storage key correctly)
    if (user) {
      fetchLessonData();
    }
  }, [dayId, user]); // Add user dependency

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">جاري تحميل الدرس...</p>
        </div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 dark:text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold">الدرس غير موجود</h2>
          <button onClick={() => navigate('/roadmap')} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            العودة للخارطة
          </button>
        </div>
      </div>
    )
  }

  const handleCompleteSection = (section) => {
    if (section !== 'exercises') {
      setCompletedSections(prev => ({ ...prev, [section]: true }))
    }
  }

  const handleOptionSelect = async (exerciseIndex, option) => {
    if (quizSubmitted) return;

    const newAnswers = {
      ...userAnswers,
      [exerciseIndex]: option
    };

    // 1. Update UI immediately
    setUserAnswers(newAnswers);

    // 2. Save to LocalStorage (Instant Save)
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newAnswers));
    }

    // 3. Auto-save to backend
    try {
      await lessonAPI.saveProgress(dayId, newAnswers);
    } catch (error) {
      console.error("Autosave failed:", error);
    }
  }

  const submitQuiz = () => {
    let correctCount = 0;
    lesson.exercises.forEach((ex, index) => {
      const userAnswer = userAnswers[index];
      if (!userAnswer) return;

      if (checkIsCorrect(ex, userAnswer)) {
        correctCount++;
      }
    });

    const calculatedScore = Math.round((correctCount / lesson.exercises.length) * 100);
    setScore(calculatedScore);
    setQuizSubmitted(true);
    setCompletedSections(prev => ({ ...prev, exercises: true }));

    // Clear Local Storage on submit
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }

    if (calculatedScore >= 60) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      setShowFeedback({ type: 'success', message: `رائع! نتيجتك ${calculatedScore}%` });
    } else {
      setShowFeedback({ type: 'error', message: `نتيجتك ${calculatedScore}%. حاول مرة أخرى لتحسين مستواك!` });
    }
  }

  const handleCompleteLesson = async () => {
    try {
      await lessonAPI.completeLesson(lesson.day, score, 30);
      await refreshProfile();
      navigate('/roadmap');
    } catch (error) {
      console.error("Error completing lesson:", error);
      setShowFeedback({ type: 'error', message: "عذراً، حدث خطأ أثناء حفظ تقدمك." });
    }
  }

  const allSectionsCompleted = Object.values(completedSections).every(v => v);





  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 p-4 md:p-6 overflow-x-hidden">

      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[60] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${showFeedback.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}
          >
            {showFeedback.type === 'success' ? <CheckCircle /> : <AlertCircle />}
            <p className="font-bold">{showFeedback.message}</p>
            <button onClick={() => setShowFeedback(null)} className="mr-4 hover:opacity-80"><XCircle size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Award className="w-64 h-64 text-purple-500" />
          </div>

          <button
            onClick={() => navigate('/roadmap')}
            className="relative z-10 flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-4 hover:gap-4 transition-all"
          >
            <ArrowRight className="w-5 h-5" />
            العودة للخارطة
          </button>

          <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-4">
            <div>
              <div className="inline-block px-4 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium mb-3">
                {lesson.levelName}
              </div>
              <h1 className="text-2xl md:text-4xl font-bold text-gray-800 dark:text-white mb-2">
                {lesson.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-2xl text-sm md:text-base">
                {lesson.description}
              </p>
            </div>
            <div className="flex gap-4 text-center w-full md:w-auto">
              <div className="bg-white/50 dark:bg-black/20 p-3 md:p-4 rounded-xl backdrop-blur-sm flex-1 md:flex-none">
                <p className="text-xs text-gray-500">النقاط</p>
                <p className="text-xl md:text-2xl font-bold text-purple-600">85+</p>
              </div>
              <div className="bg-white/50 dark:bg-black/20 p-3 md:p-4 rounded-xl backdrop-blur-sm flex-1 md:flex-none">
                <p className="text-xs text-gray-500">الوقت</p>
                <p className="text-xl md:text-2xl font-bold text-blue-600">{lesson.estimatedTime}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="glass rounded-3xl p-2 md:p-4 mb-6 sticky top-4 z-30 shadow-lg backdrop-blur-xl bg-white/80 dark:bg-gray-800/80">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl font-medium whitespace-nowrap transition-all flex-shrink-0 ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
                {completedSections[tab.id] && <CheckCircle className="w-4 h-4 text-green-400 bg-white rounded-full" />}
              </motion.button>
            ))}
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="glass rounded-3xl p-4 md:p-8 min-h-[400px]"
        >
          {activeTab === 'video' && (
            <div className="text-center">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white mb-6">
                شاهد وتعلم
              </h2>
              <div className="aspect-video bg-gray-900 rounded-2xl mb-6 flex items-center justify-center relative group cursor-pointer shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 group-hover:opacity-0 transition-opacity" />
                <Play className="w-16 h-16 md:w-24 md:h-24 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                <p className="absolute bottom-4 right-4 text-white text-sm bg-black/50 px-2 py-1 rounded">12:30</p>
              </div>
              <button
                onClick={() => handleCompleteSection('video')}
                className={`w-full py-4 rounded-xl font-bold transition-all transform hover:scale-[1.01] ${completedSections.video
                  ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'
                  }`}
              >
                {completedSections.video ? '✓ تم مشاهدة الفيديو' : 'أكملت المشاهدة، التالي'}
              </button>
            </div>
          )}

          {activeTab === 'vocabulary' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
                  الكلمات الجديدة
                </h2>
                <span className="text-xs md:text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full">{lesson.vocabulary.length} كلمات</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {lesson.vocabulary.map((vocab, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xl md:text-2xl font-bold text-purple-600" dir="ltr">{vocab.word}</div>
                      <button onClick={() => speakWord(vocab.word)} className="text-gray-400 hover:text-purple-500"><Play size={16} /></button>
                    </div>
                    <div className="text-lg md:text-xl text-gray-800 dark:text-white mb-2 font-medium">
                      {vocab.translation}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg" dir="ltr">
                      "{vocab.example}"
                    </div>
                  </motion.div>
                ))}
              </div>
              <button
                onClick={() => handleCompleteSection('vocabulary')}
                className={`w-full py-4 rounded-xl font-bold transition-all transform hover:scale-[1.01] ${completedSections.vocabulary
                  ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'
                  }`}
              >
                {completedSections.vocabulary ? '✓ تم حفظ الكلمات' : 'حفظت الكلمات، التالي'}
              </button>
            </div>
          )}

          {activeTab === 'grammar' && (
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white mb-6">
                شرح القواعد: {lesson.grammar.topic}
              </h2>
              <div className="prose dark:prose-invert max-w-none bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl mb-8 border border-gray-100 dark:border-gray-700">
                <p className="text-base md:text-lg leading-relaxed text-gray-700 dark:text-gray-300" dir="ltr">
                  {lesson.grammar.description}
                </p>

                <div className="mt-8 grid gap-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border-l-4 border-yellow-400">
                    <h4 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">💡 قاعدة مهمة</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">Remember to always use the verb 'to be' with continuous tenses.</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleCompleteSection('grammar')}
                className={`w-full py-4 rounded-xl font-bold transition-all transform hover:scale-[1.01] ${completedSections.grammar
                  ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'
                  }`}
              >
                {completedSections.grammar ? '✓ تم دراسة القواعد' : 'فهمت القاعدة، التالي'}
              </button>
            </div>
          )}

          {activeTab === 'reading' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
                  النص القرائي
                </h2>
                <span className="text-xs md:text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                  ممارسة القراءة
                </span>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
                <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line dir-ltr font-serif">
                  {lesson.readingExercise?.text || "No reading text available."}
                </p>
              </div>

              {/* Reading Questions Section Removed as per request */}

              <button
                onClick={() => handleCompleteSection('reading')}
                className={`w-full py-4 rounded-xl font-bold transition-all transform hover:scale-[1.01] ${completedSections.reading
                  ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'
                  }`}
              >
                {completedSections.reading ? '✓ تم القراءة' : 'أكملت القراءة، التالي'}
              </button>
            </div>
          )}

          {activeTab === 'exercises' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
                  {quizSubmitted ? `نتيجتك: ${score}%` : 'اختبر نفسك'}
                </h2>
                {!quizSubmitted && (
                  <span className="text-xs md:text-sm text-gray-500">
                    {Object.keys(userAnswers).length} / {lesson.exercises.length} مجاب
                  </span>
                )}
              </div>

              <div className="space-y-8 mb-8">
                {lesson.exercises.map((exercise, index) => {
                  const options = getOptions(exercise);
                  const userAnswer = userAnswers[index];
                  const isCorrect = checkIsCorrect(exercise, userAnswer);
                  const correctAnswer = exercise.correctAnswer !== undefined ? exercise.correctAnswer : exercise.correct_answer;

                  return (
                    <motion.div
                      key={exercise.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-4 md:p-6 rounded-2xl border-2 transition-all ${quizSubmitted
                        ? (isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-red-500 bg-red-50 dark:bg-red-900/10')
                        : 'border-transparent bg-white dark:bg-gray-800 hover:border-purple-200'
                        }`}
                    >
                      <div className="flex flex-col gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 font-bold text-sm">
                            {index + 1}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${isMultipleChoice(exercise) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                            getExerciseType(exercise) === 'translate' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                              'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                            }`}>
                            {getQuestionTypeLabel(exercise)}
                          </span>
                          {quizSubmitted && (
                            isCorrect ? <CheckCircle className="text-green-500 flex-shrink-0 mr-auto" /> : <XCircle className="text-red-500 flex-shrink-0 mr-auto" />
                          )}
                        </div>
                        <p className="text-base md:text-lg font-medium text-gray-800 dark:text-white dir-ltr pr-10">
                          {exercise.question}
                        </p>
                      </div>

                      <div className="pl-0 md:pl-11">
                        {isMultipleChoice(exercise) ? (
                          // Multiple Choice Grid
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {options.map((option, i) => {
                              const isSelected = userAnswer === option;
                              const isCorrectOption = i === correctAnswer;

                              let btnClass = "p-3 rounded-xl text-left transition-all border-2 w-full ";

                              if (quizSubmitted) {
                                if (isCorrectOption) btnClass += "bg-green-500 text-white border-green-500";
                                else if (isSelected && !isCorrectOption) btnClass += "bg-red-100 text-red-700 border-red-500";
                                else btnClass += "bg-gray-100 dark:bg-gray-700 opacity-50 border-transparent";
                              } else {
                                if (isSelected) btnClass += "bg-purple-600 text-white border-purple-600 shadow-md transform scale-[1.02]";
                                else btnClass += "bg-gray-50 dark:bg-gray-700 hover:bg-purple-50 dark:hover:bg-gray-600 border-transparent";
                              }

                              return (
                                <button
                                  key={i}
                                  onClick={() => handleOptionSelect(index, option)}
                                  disabled={quizSubmitted}
                                  className={btnClass}
                                  dir="ltr"
                                >
                                  {option}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          // Text Input for Fill Blank / Translate
                          <div className="relative">
                            <input
                              type="text"
                              value={userAnswer || ''}
                              onChange={(e) => handleOptionSelect(index, e.target.value)}
                              disabled={quizSubmitted}
                              className={`w-full p-4 rounded-xl border-2 outline-none transition-all shadow-sm ${quizSubmitted
                                ? (isCorrect ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700')
                                : 'border-gray-300 bg-white dark:bg-gray-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/50'
                                }`}
                              placeholder={getPlaceholder(exercise)}
                              dir="ltr"
                            />
                            {quizSubmitted && !isCorrect && (
                              <div className="mt-2 text-sm text-red-500 dir-ltr text-right">
                                الإجابة الصحيحة: <span className="font-bold">{correctAnswer}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Explanation Block - Shows after submission */}
                      {quizSubmitted && exercise.explanation && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                          <div className="flex items-start gap-2">
                            <span className="text-xl">💡</span>
                            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed dir-rtl text-right">
                              {exercise.explanation}
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {!quizSubmitted ? (
                <button
                  onClick={() => {
                    const answeredCount = Object.keys(userAnswers).length;
                    const totalCount = lesson.exercises.length;
                    if (answeredCount < totalCount) {
                      setShowFeedback({ type: 'error', message: `يرجى الإجابة على جميع الأسئلة (${answeredCount}/${totalCount})` });
                    } else {
                      submitQuiz();
                    }
                  }}
                  className={`w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg transition-all transform active:scale-95 mb-16 ${Object.keys(userAnswers).length < lesson.exercises.length ? 'opacity-70' : ''}`}
                >
                  عرض النتيجة
                </button>
              ) : (
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl mb-16">
                  <p className="text-gray-600 dark:text-gray-300 mb-2">تم تسجيل نتيجتك</p>
                  <div className="font-bold text-purple-600 text-xl mb-4">
                    {score >= 50 ? 'ممتاز! يمكنك المتابعة' : 'حاول مراجعة الدرس مرة أخرى'}
                  </div>
                  <button
                    onClick={() => {
                      setQuizSubmitted(false);
                      setUserAnswers({});
                      setScore(0);
                      setCompletedSections(prev => ({ ...prev, exercises: false }));
                    }}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    🔄 إعادة الاختبار
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Global Completion Action - Only appears if quiz passed */}
        {allSectionsCompleted && quizSubmitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t dark:border-gray-800 z-50 flex justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
          >
            <div className="max-w-4xl w-full flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🎉</div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-white">أحسنت! أكملت الدرس بنجاح</h3>
                  <p className="text-xs md:text-sm text-gray-500">تم حفظ تقدمك وإضافة النقاط</p>
                </div>
              </div>
              <button
                onClick={handleCompleteLesson}
                className="w-full md:w-auto px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg hover:shadow-green-500/30 transition-all flex items-center justify-center gap-2"
              >
                انتقل للدرس التالي <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default LessonView
