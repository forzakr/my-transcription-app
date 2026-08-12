'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { lawData } from '@/data/lawData';
import { 
  BookOpen, CheckCircle, Clock, Play, Pause, RotateCcw, 
  ChevronRight, ChevronDown, Settings, Menu, X, Sun, Moon, Eye, EyeOff, HelpCircle, AlertCircle, CornerDownLeft, PanelLeftClose, PanelLeft, Maximize, Minimize, Plus, Minus, Coffee, ArrowLeft, ArrowRight, Lightbulb, Keyboard
} from 'lucide-react';

// 한글 초성 추출 함수
function getChosung(text) {
  const CHOSUNG_LIST = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 
    'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 
    'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 44032;
    if (code >= 0 && code <= 11172) {
      result += CHOSUNG_LIST[Math.floor(code / 588)];
    } else {
      result += text[i];
    }
  }
  return result;
}

// 한글, 영어, 숫자만 남기는 정규화 함수
function sanitizeText(text) {
  if (!text) return '';
  return text.replace(/[^가-힣a-zA-Z0-9]/g, '');
}

// 실시간 일치율(정확도) 계산 함수
function calculateRealtimeAccuracy(userInput, targetText) {
  const cleanInput = sanitizeText(userInput);
  const cleanTarget = sanitizeText(targetText);

  if (!cleanInput) return 0;
  if (!cleanTarget) return 0;

  let correctChars = 0;
  const minLen = Math.min(cleanInput.length, cleanTarget.length);
  
  for (let i = 0; i < minLen; i++) {
    if (cleanInput[i] === cleanTarget[i]) {
      correctChars++;
    }
  }

  const accuracy = Math.round((correctChars / cleanInput.length) * 100);
  return Math.min(100, Math.max(0, accuracy));
}

export default function TranscriptionApp() {
  // 기본 학습 상태
  const [selectedItemId, setSelectedItemId] = useState('item-1-1');
  const [openChapters, setOpenChapters] = useState({ ch1: true, ch2: true });
  const [userInput, setUserInput] = useState('');
  const [completedItems, setCompletedItems] = useState({});
  const [itemStudyCounts, setItemStudyCounts] = useState({});

  // 검증 상태
  const [accuracy, setAccuracy] = useState(0);
  const [isPass, setIsPass] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);

  // 핵심 해설 팝업(모달) 상태
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  // UI 제어 상태
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 사용자 맞춤 설정 (기본값)
  const [theme, setTheme] = useState('dark');
  const [fontFamily, setFontFamily] = useState('font-sans');
  const [fontSizePx, setFontSizePx] = useState(18);
  const [targetRepeatCount, setTargetRepeatCount] = useState(1);
  const [currentRepeatCount, setCurrentRepeatCount] = useState(0);

  // 학습 순서
  const [isRandomMode, setIsRandomMode] = useState(false);
  
  // ★ [개선] 학습 모드 3가지 정립: 'normal'(일반필사) | 'chosung'(초성필사) | 'blank'(빈칸암기)
  const [studyMode, setStudyMode] = useState('normal'); 
  
  // ★ [개선] 빈칸/초성 적용 시점: 'all'(모든 회차) | 'last'(마지막 회차만)
  const [modeTiming, setModeTiming] = useState('all'); 
  const [blankType, setBlankType] = useState('matchLength');

  // 메인 화면 버튼 토글용 상태
  const [showChosungHint, setShowChosungHint] = useState(false);
  const [showFullAnswer, setShowFullAnswer] = useState(false);

  // 뽀모도로 타이머 상태
  const [studyTimeSetting, setStudyTimeSetting] = useState(25);
  const [restTimeSetting, setRestTimeSetting] = useState(5);
  const [timerMode, setTimerMode] = useState('study');
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // 데이터 평탄화
  const allItems = useMemo(() => lawData.chapters.flatMap(ch => ch.items), []);

  const currentItem = useMemo(() => 
    allItems.find(item => item.id === selectedItemId), [allItems, selectedItemId]
  );

  const currentChapter = useMemo(() => 
    lawData.chapters.find(ch => ch.items.some(item => item.id === selectedItemId)), [selectedItemId]
  );

  // ★ 현재 회차에서 변형 모드(초성 or 빈칸)를 적용할 타이밍인지 판별
  const isSpecialModeActive = useMemo(() => {
    if (studyMode === 'normal') return false;
    if (modeTiming === 'all') return true;
    if (modeTiming === 'last') {
      return targetRepeatCount === 1 ? true : currentRepeatCount === targetRepeatCount - 1;
    }
    return false;
  }, [studyMode, modeTiming, targetRepeatCount, currentRepeatCount]);

  // ★ 화면에 보여줄 원문 텍스트 연산
  const displayedLawText = useMemo(() => {
    if (!currentItem) return '';

    // 정답 보기 클릭 시 전체 공개
    if (showFullAnswer) return currentItem.law;

    // 초성 힌트 토글 또는 초성 필사 모드인 경우
    const effectiveChosung = showChosungHint || (isSpecialModeActive && studyMode === 'chosung');

    if (isSpecialModeActive) {
      const words = currentItem.law.split(' ');
      const eligibleIndices = words
        .map((word, idx) => (word.length >= 2 ? idx : -1))
        .filter(idx => idx !== -1);

      if (eligibleIndices.length === 0) return currentItem.law;

      const targetCount = Math.min(Math.max(2, Math.floor(eligibleIndices.length / 3)), 3);
      const step = Math.floor(eligibleIndices.length / targetCount);
      const maskedIndices = new Set();
      for (let i = 0; i < targetCount; i++) {
        maskedIndices.add(eligibleIndices[Math.min(i * step + Math.floor(step / 2), eligibleIndices.length - 1)]);
      }

      return words.map((word, idx) => {
        if (maskedIndices.has(idx)) {
          const targetLength = Math.min(word.length, 4);
          const restWord = word.slice(targetLength);
          const maskPart = word.slice(0, targetLength);

          if (effectiveChosung) {
            return `[${getChosung(maskPart)}]` + restWord;
          } else {
            return (blankType === 'fixed' ? 'OO' : 'O'.repeat(targetLength)) + restWord;
          }
        }
        return word;
      }).join(' ');
    }

    // 일반 모드에서 초성 토글만 누른 경우
    if (showChosungHint) {
      return getChosung(currentItem.law);
    }

    return currentItem.law;
  }, [currentItem, isSpecialModeActive, studyMode, showChosungHint, showFullAnswer, blankType]);

  // LocalStorage 복원
  useEffect(() => {
    const savedProgress = localStorage.getItem('transcription_progress');
    if (savedProgress) setCompletedItems(JSON.parse(savedProgress));

    const savedCounts = localStorage.getItem('transcription_study_counts');
    if (savedCounts) setItemStudyCounts(JSON.parse(savedCounts));

    const savedStudyTime = localStorage.getItem('pomo_study_time');
    if (savedStudyTime) {
      const mins = Number(savedStudyTime);
      setStudyTimeSetting(mins);
      setTimerSeconds(mins * 60);
    }

    const savedRestTime = localStorage.getItem('pomo_rest_time');
    if (savedRestTime) setRestTimeSetting(Number(savedRestTime));
  }, []);

  // 뽀모도로 타이머
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(s => s - 1), 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      if (timerMode === 'study') {
        alert(`🎉 ${studyTimeSetting}분 집중 학습이 끝났습니다! ${restTimeSetting}분 휴식이 시작됩니다.`);
        setTimerMode('rest');
        setTimerSeconds(restTimeSetting * 60);
      } else {
        alert(`☕ ${restTimeSetting}분 휴식이 끝났습니다! 다시 학습을 시작하세요.`);
        setTimerMode('study');
        setTimerSeconds(studyTimeSetting * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, timerMode, studyTimeSetting, restTimeSetting]);

  // 전체화면 토글
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // 실시간 입력 검증
  const handleInputChange = (e) => {
    const val = e.target.value;
    setUserInput(val);

    if (!currentItem) return;

    const realAcc = calculateRealtimeAccuracy(val, currentItem.law);
    setAccuracy(realAcc);

    const cleanVal = sanitizeText(val);
    const cleanTarget = sanitizeText(currentItem.law);

    if (cleanVal.length >= cleanTarget.length - 2) {
      if (realAcc >= 90) {
        setIsPass(true);
        setShowErrorAlert(false);
      } else {
        setIsPass(false);
        setShowErrorAlert(true);
      }
    } else {
      setIsPass(false);
      setShowErrorAlert(false);
    }
  };

  const getNextItemId = useCallback(() => {
    if (isRandomMode) {
      const otherItems = allItems.filter(item => item.id !== selectedItemId);
      if (otherItems.length === 0) return selectedItemId;
      return otherItems[Math.floor(Math.random() * otherItems.length)].id;
    } else {
      const currentIndex = allItems.findIndex(item => item.id === selectedItemId);
      return currentIndex < allItems.length - 1 ? allItems[currentIndex + 1].id : null;
    }
  }, [allItems, isRandomMode, selectedItemId]);

  const getPrevItemId = useCallback(() => {
    const currentIndex = allItems.findIndex(item => item.id === selectedItemId);
    return currentIndex > 0 ? allItems[currentIndex - 1].id : null;
  }, [allItems, selectedItemId]);

  const handleSelectItem = useCallback((id) => {
    if (!id) return;
    setSelectedItemId(id);
    setUserInput('');
    setCurrentRepeatCount(0);
    setAccuracy(0);
    setIsPass(false);
    setShowErrorAlert(false);
    setShowChosungHint(false);
    setShowFullAnswer(false);
    setShowExplanationModal(false);
    setIsSidebarOpen(false);
  }, []);

  // ★ [수정] 현재 문장 복습 함수 (입력창 및 패스 상태 깨끗이 초기화)
  const resetCurrentSentence = useCallback(() => {
    setUserInput('');
    setAccuracy(0);
    setIsPass(false);
    setShowErrorAlert(false);
    setShowChosungHint(false);
    setShowFullAnswer(false);
    setShowExplanationModal(false);
  }, []);

  const proceedNextStep = useCallback(() => {
    if (!currentItem) return;

    const currentCount = itemStudyCounts[currentItem.id] || 0;
    const newCounts = { ...itemStudyCounts, [currentItem.id]: currentCount + 1 };
    setItemStudyCounts(newCounts);
    localStorage.setItem('transcription_study_counts', JSON.stringify(newCounts));

    const nextCount = currentRepeatCount + 1;

    if (nextCount < targetRepeatCount) {
      setCurrentRepeatCount(nextCount);
      setUserInput('');
      setAccuracy(0);
      setIsPass(false);
      setShowChosungHint(false);
      setShowFullAnswer(false);
      setShowExplanationModal(false);
    } else {
      const updatedProgress = { ...completedItems, [currentItem.id]: true };
      setCompletedItems(updatedProgress);
      localStorage.setItem('transcription_progress', JSON.stringify(updatedProgress));

      const nextId = getNextItemId();
      if (nextId) {
        handleSelectItem(nextId);
      } else {
        setShowExplanationModal(false);
        alert('🎉 모든 학습 문장을 완료하셨습니다!');
      }
    }
  }, [currentItem, itemStudyCounts, currentRepeatCount, targetRepeatCount, completedItems, getNextItemId, handleSelectItem]);

  // Enter 키 핸들러
  const handleKeyDown = (e) => {
    if (showExplanationModal && e.key === 'Enter') {
      e.preventDefault();
      proceedNextStep();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (isPass) {
        if (currentItem?.example) {
          setShowExplanationModal(true);
        } else {
          proceedNextStep();
        }
      } else if (sanitizeText(userInput).length >= sanitizeText(currentItem?.law || '').length - 2) {
        setShowErrorAlert(true);
      }
    }
  };

  // ★ 글로벌 단축키 (Esc: 현재문장 초기화 복습 / Ctrl+Space: 초성 / ←→: 이동)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (showExplanationModal && e.key === 'Escape') {
        e.preventDefault();
        resetCurrentSentence();
        return;
      }

      if ((e.ctrlKey || e.altKey) && e.code === 'Space') {
        e.preventDefault();
        setShowChosungHint(prev => !prev);
        return;
      }

      const isInputActive = document.activeElement?.tagName === 'TEXTAREA';
      if (!isInputActive || showExplanationModal) {
        if (e.key === 'ArrowLeft') {
          const prevId = getPrevItemId();
          if (prevId) handleSelectItem(prevId);
        } else if (e.key === 'ArrowRight') {
          const nextId = getNextItemId();
          if (nextId) handleSelectItem(nextId);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [getPrevItemId, getNextItemId, handleSelectItem, showExplanationModal, resetCurrentSentence]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800';
  const bgSidebar = isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200';
  const bgCard = isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const bgInput = isDark ? 'bg-slate-900/90 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors duration-200 ${bgMain}`}>
      
      {/* 모바일 헤더 */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 border-b border-slate-700/50 flex items-center justify-between px-4 z-40 bg-slate-950/80 backdrop-blur">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg bg-slate-800/50 text-slate-200">
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <span className="font-bold text-sm tracking-tight text-slate-200">스마트 필사 스튜디오</span>
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-lg bg-slate-800/50 text-slate-200">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* 1. 사이드바 (목차 영역) */}
      {isSidebarVisible && (
        <aside className={`fixed md:static top-14 md:top-0 bottom-0 left-0 z-30 w-80 md:w-96 border-r flex flex-col transition-all duration-300 ${bgSidebar} ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          <div className="p-4 border-b border-inherit hidden md:flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="text-blue-500 w-6 h-6" />
              <h1 className="font-bold text-base tracking-wide">학습 목차</h1>
            </div>
            <button onClick={() => setIsSidebarVisible(false)} className={`p-2 rounded-lg hover:bg-slate-800/20 ${textMuted}`} title="목차 숨기기">
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {lawData.chapters.map((chapter) => (
              <div key={chapter.id} className="space-y-1.5">
                <button
                  onClick={() => setOpenChapters(prev => ({ ...prev, [chapter.id]: !prev[chapter.id] }))}
                  className={`w-full flex items-center justify-between p-2.5 font-bold rounded-xl transition ${textMuted} hover:bg-blue-500/10 ${fontFamily}`}
                  style={{ fontSize: `${Math.max(14, fontSizePx - 2)}px` }}
                >
                  <span className="truncate">{chapter.title}</span>
                  {openChapters[chapter.id] ? <ChevronDown className="w-5 h-5 shrink-0" /> : <ChevronRight className="w-5 h-5 shrink-0" />}
                </button>

                {openChapters[chapter.id] && (
                  <div className="pl-3 space-y-1 border-l-2 border-slate-700/50 ml-2">
                    {chapter.items.map((item) => {
                      const isSelected = item.id === selectedItemId;
                      const isDone = completedItems[item.id];
                      const totalCount = itemStudyCounts[item.id] || 0;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectItem(item.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${fontFamily} ${
                            isSelected 
                              ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-400/50 translate-x-1' 
                              : `${textMuted} hover:bg-slate-500/10 hover:text-slate-200`
                          }`}
                          style={{ fontSize: `${Math.max(13, fontSizePx - 3)}px` }}
                        >
                          <span className="truncate pr-2">{item.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {totalCount > 0 && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${
                                isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {totalCount}회
                              </span>
                            )}
                            {isDone && <CheckCircle className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-inherit bg-inherit">
            <div className={`flex justify-between text-xs mb-1.5 font-medium ${textMuted}`}>
              <span>전체 학습 진도율</span>
              <span className="font-mono font-bold">{Math.round((Object.keys(completedItems).length / allItems.length) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-700/30 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${(Object.keys(completedItems).length / allItems.length) * 100}%` }} />
            </div>
          </div>
        </aside>
      )}

      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}

      {/* 2. 메인 영역 */}
      <div className="flex-1 flex flex-col h-full pt-14 md:pt-0 overflow-hidden">
        
        <header className={`h-14 border-b border-inherit px-4 md:px-6 flex items-center justify-between shrink-0 ${bgSidebar}`}>
          <div className="flex items-center gap-3">
            {!isSidebarVisible && (
              <button onClick={() => setIsSidebarVisible(true)} className={`hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-inherit hover:bg-slate-500/10 ${textMuted}`}>
                <PanelLeft className="w-4 h-4 text-blue-500" />
                <span>목차 열기</span>
              </button>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSelectItem(getPrevItemId())}
                disabled={!getPrevItemId()}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-inherit transition ${
                  getPrevItemId() ? 'hover:bg-slate-500/10 text-slate-200' : 'opacity-40 cursor-not-allowed text-slate-500'
                }`}
                title="이전 문장 (단축키: ←)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">이전 문장</span>
              </button>

              <button
                onClick={() => handleSelectItem(getNextItemId())}
                disabled={!getNextItemId()}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-inherit transition ${
                  getNextItemId() ? 'hover:bg-slate-500/10 text-slate-200' : 'opacity-40 cursor-not-allowed text-slate-500'
                }`}
                title="다음 문장 (단축키: →)"
              >
                <span className="hidden sm:inline">다음 문장</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ★ [개선] 상단 헤더 우측 컨트롤 영역 (설정 버튼 추가) */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* 설정 버튼 */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-inherit hover:bg-slate-500/10 transition font-medium ${textMuted}`}
              title="학습 환경 설정"
            >
              <Settings className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">설정</span>
            </button>

            {/* 전체화면 토글 */}
            <button
              onClick={toggleFullscreen}
              className={`p-2 rounded-lg border border-inherit hover:bg-slate-500/10 transition ${textMuted}`}
              title={isFullscreen ? "전체화면 해제" : "전체화면 전환"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4 text-amber-500" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* 뽀모도로 타이머 */}
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${
              timerMode === 'study' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {timerMode === 'study' ? <Clock className="w-3.5 h-3.5" /> : <Coffee className="w-3.5 h-3.5" />}
              <span className="font-medium hidden sm:inline">{timerMode === 'study' ? '집중' : '휴식'}:</span>
              <span className="font-mono font-bold text-sm">{formatTime(timerSeconds)}</span>
              
              <button onClick={() => setIsTimerRunning(!isTimerRunning)} className="hover:opacity-75 transition ml-1">
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={() => { 
                  setIsTimerRunning(false); 
                  setTimerSeconds((timerMode === 'study' ? studyTimeSetting : restTimeSetting) * 60); 
                }} 
                className="hover:opacity-75 transition"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6 pb-20">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-inherit pb-3">
            <div>
              <h2 className="text-lg md:text-xl font-bold">{currentItem?.title}</h2>
              <p className={`text-xs mt-0.5 ${textMuted}`}>
                {isSpecialModeActive 
                  ? studyMode === 'blank' ? '★ 빈칸 암기 모드: 빈칸 단어를 떠올리며 원문을 완성하세요.' : '★ 초성 힌트 모드: 초성 힌트를 보며 원문을 입력하세요.'
                  : '원문을 올바르게 따라 쓰며 몰입 필사를 진행하세요.'}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="bg-slate-500/10 px-3 py-1.5 rounded-lg border border-inherit text-xs font-medium">
                <span className={textMuted}>누적 완수: </span>
                <span className="font-bold text-emerald-500 font-mono">{itemStudyCounts[currentItem?.id] || 0}회</span>
              </div>

              <div className="bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 text-xs">
                <span className="text-blue-500 font-medium">목표 진행: </span>
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-sm">
                  {currentRepeatCount + 1} / {targetRepeatCount} 회
                </span>
              </div>
            </div>
          </div>

          {/* 학습 원문 카드리스트 */}
          <div className={`p-4 md:p-6 rounded-2xl border ${bgCard} space-y-4`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                {isSpecialModeActive ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
                {isSpecialModeActive ? (studyMode === 'blank' ? '학습 원문 (빈칸 모드)' : '학습 원문 (초성 모드)') : '학습 원문'}
              </span>

              {/* 힌트 및 정답 보기 버튼 그룹 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowChosungHint(prev => !prev);
                    setShowFullAnswer(false);
                  }}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition font-medium select-none ${
                    showChosungHint 
                      ? 'bg-amber-500 text-slate-950 font-bold' 
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30'
                  }`}
                  title="단축키: Ctrl + Space"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  {showChosungHint ? '초성 숨기기' : '초성 힌트'}
                </button>

                {isSpecialModeActive && (
                  <button
                    onClick={() => {
                      setShowFullAnswer(prev => !prev);
                      setShowChosungHint(false);
                    }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition font-medium select-none ${
                      showFullAnswer 
                        ? 'bg-emerald-500 text-slate-950 font-bold' 
                        : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showFullAnswer ? '정답 숨기기' : '정답 보기'}
                  </button>
                )}
              </div>
            </div>
            
            {/* 원문 출력 */}
            <div 
              className={`p-4 rounded-xl border border-inherit leading-relaxed select-none ${
                showFullAnswer
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold'
                  : isSpecialModeActive 
                    ? 'bg-amber-500/10 border-amber-500/30 font-bold text-amber-600 dark:text-amber-400' 
                    : showChosungHint
                      ? 'bg-amber-500/10 border-amber-500/30 font-bold text-amber-400'
                      : 'bg-slate-500/5'
              } ${fontFamily}`}
              style={{ fontSize: `${fontSizePx}px` }}
            >
              {displayedLawText}
            </div>

            {/* 입력 영역 */}
            <div className="space-y-2">
              <textarea
                value={userInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isSpecialModeActive ? "원문 전체를 정확히 입력 후 Enter를 누르세요..." : "위 원문과 일치하도록 입력 후 Enter를 누르세요..."}
                className={`w-full h-32 p-4 rounded-xl border transition focus:outline-none focus:ring-2 resize-none ${
                  isPass 
                    ? 'border-emerald-500 focus:ring-emerald-500/50' 
                    : showErrorAlert 
                      ? 'border-rose-500/80 focus:ring-rose-500/50' 
                      : 'border-slate-700 focus:ring-blue-500/50'
                } ${bgInput} ${fontFamily}`}
                style={{ fontSize: `${fontSizePx}px` }}
              />
              
              {isPass && (
                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-xs font-medium animate-bounce">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    작성 완료! (일치율 {accuracy}%) <strong>Enter 키</strong>를 누르면 해설을 확인합니다.
                  </span>
                  <CornerDownLeft className="w-4 h-4" />
                </div>
              )}

              {showErrorAlert && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>현재 문장 일치율 <strong>{accuracy}%</strong> 입니다. 오탈자를 확인해 주세요 (90% 이상 작성 후 Enter).</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                <span>실시간 작성 정확도 판별 중</span>
                <span className="font-mono font-medium">문자 일치율: {accuracy}%</span>
              </div>
            </div>
          </div>

        </main>

        {/* 하단 단축키 안내 바 */}
        <footer className={`fixed bottom-0 left-0 right-0 h-10 border-t border-inherit px-4 flex items-center justify-between z-20 text-xs ${bgSidebar}`}>
          <div className="flex items-center gap-4 text-slate-400 overflow-x-auto py-1">
            <span className="flex items-center gap-1 font-semibold text-blue-400 shrink-0">
              <Keyboard className="w-3.5 h-3.5" /> 단축키 안내:
            </span>
            <span className="shrink-0"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">← / →</kbd> 문장 이동</span>
            <span className="shrink-0"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">Ctrl + Space</kbd> 초성 힌트</span>
            <span className="shrink-0"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">Shift + Enter</kbd> 줄바꿈</span>
            <span className="shrink-0"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">Enter</kbd> 검수 & 해설</span>
            <span className="shrink-0"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">Esc</kbd> 초기화 후 복습</span>
          </div>
        </footer>

      </div>

      {/* ★ [수정] 해설 팝업 모달 (Esc 누르면 깨끗이 초기화 후 복습) */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className={`w-full max-w-2xl p-8 rounded-3xl border shadow-2xl ${bgCard} space-y-6 border-amber-500/40`}>
            <div className="flex items-center justify-between border-b border-inherit pb-4">
              <h3 className="font-bold text-xl flex items-center gap-2.5 text-amber-500">
                <Lightbulb className="w-6 h-6" /> 핵심 해설 & 적용
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono bg-slate-800 px-3 py-1 rounded-full">Enter: 다음 | Esc: 복습</span>
                <button onClick={resetCurrentSentence} className="p-1 rounded-lg text-slate-400 hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div 
              className={`p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 leading-relaxed tracking-wide ${fontFamily}`}
              style={{ fontSize: `${Math.max(18, fontSizePx + 2)}px` }}
            >
              {currentItem?.example || '등록된 추가 해설이 없습니다.'}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={resetCurrentSentence}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition text-xs"
              >
                [Esc] 초기화 후 현재 문장 복습
              </button>
              <button
                onClick={proceedNextStep}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition text-sm shadow-lg flex items-center gap-2"
              >
                [Enter] 다음 문장으로 이동 ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 환경 설정 모달 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-xl ${bgCard} space-y-6 max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between border-b border-inherit pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" /> 학습 환경 설정
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className={`p-1 rounded-lg ${textMuted} hover:bg-slate-500/20`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 text-xs md:text-sm">
              
              {/* ★ [신규 개편] 학습 모드 방식 선택 (3가지) */}
              <div className="space-y-2">
                <label className="font-semibold block text-blue-400">기본 학습 모드</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '일반 필사', val: 'normal' },
                    { label: '초성 힌트', val: 'chosung' },
                    { label: '빈칸 암기', val: 'blank' }
                  ].map((mode) => (
                    <button
                      key={mode.val}
                      onClick={() => setStudyMode(mode.val)}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        studyMode === mode.val ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ★ [유지] 초성/빈칸 암기 모드 적용 시점 설정 */}
              {studyMode !== 'normal' && (
                <div className="space-y-2 bg-slate-500/5 p-3 rounded-xl border border-inherit">
                  <label className="font-semibold block">암기 모드 적용 시점</label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setModeTiming('all')}
                      className={`p-2 rounded-lg border text-center transition ${
                        modeTiming === 'all' ? 'border-amber-500 bg-amber-500/10 font-bold text-amber-500' : 'border-inherit'
                      }`}
                    >
                      모든 회차 적용
                    </button>
                    <button
                      onClick={() => setModeTiming('last')}
                      className={`p-2 rounded-lg border text-center transition ${
                        modeTiming === 'last' ? 'border-amber-500 bg-amber-500/10 font-bold text-amber-500' : 'border-inherit'
                      }`}
                    >
                      마지막 회차만
                    </button>
                  </div>
                </div>
              )}

              {/* 뽀모도로 타이머 직접 입력 설정 */}
              <div className="space-y-2 bg-slate-500/5 p-3.5 rounded-xl border border-inherit">
                <label className="font-semibold block flex items-center gap-1.5 text-blue-400">
                  <Clock className="w-4 h-4" /> 뽀모도로 타이머 시간 설정 (분 단위)
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">집중 공부 시간 (분)</span>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={studyTimeSetting}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value));
                        setStudyTimeSetting(val);
                        localStorage.setItem('pomo_study_time', val);
                        if (timerMode === 'study') {
                          setTimerSeconds(val * 60);
                          setIsTimerRunning(false);
                        }
                      }}
                      className="w-full p-2.5 rounded-lg border border-slate-700 bg-slate-900 text-center font-bold text-blue-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">쉬는 시간 (분)</span>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={restTimeSetting}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value));
                        setRestTimeSetting(val);
                        localStorage.setItem('pomo_rest_time', val);
                        if (timerMode === 'rest') {
                          setTimerSeconds(val * 60);
                          setIsTimerRunning(false);
                        }
                      }}
                      className="w-full p-2.5 rounded-lg border border-slate-700 bg-slate-900 text-center font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* 목표 문장 반복 횟수 */}
              <div className="space-y-2">
                <label className="font-semibold block">목표 문장 반복 횟수</label>
                <div className="flex items-center justify-between p-2 rounded-xl border border-inherit bg-slate-500/5">
                  <button 
                    onClick={() => setTargetRepeatCount(prev => Math.max(1, prev - 1))}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-base font-mono text-blue-400">{targetRepeatCount} 회</span>
                  <button 
                    onClick={() => setTargetRepeatCount(prev => prev + 1)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 폰트 스타일 & 글자 크기 실시간 미리보기 */}
              <div className="space-y-3 bg-slate-500/5 p-3.5 rounded-xl border border-inherit">
                <label className="font-semibold block text-emerald-400">글자 크기 & 폰트 스타일 (실시간 미리보기)</label>
                
                <div 
                  className={`p-3.5 rounded-lg border border-emerald-500/30 bg-slate-950 text-slate-200 leading-relaxed overflow-hidden transition-all ${fontFamily}`}
                  style={{ fontSize: `${fontSizePx}px` }}
                >
                  한글 ABC 123 :: 가나다라 필사 학습 미리보기
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400">글자 크기 조절:</span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setFontSizePx(prev => Math.max(12, prev - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-bold font-mono text-sm w-12 text-center">{fontSizePx} px</span>
                    <button 
                      onClick={() => setFontSizePx(prev => Math.min(32, prev + 1))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-xs text-slate-400">폰트 종류:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '고딕체 (Sans)', val: 'font-sans' },
                      { label: '바탕체 (Serif)', val: 'font-serif' },
                      { label: '고정폭 (Mono)', val: 'font-mono' }
                    ].map((item) => (
                      <button
                        key={item.val}
                        onClick={() => setFontFamily(item.val)}
                        className={`p-2 rounded-lg border text-xs text-center transition ${
                          fontFamily === item.val ? 'border-emerald-500 bg-emerald-500/10 font-bold text-emerald-400' : 'border-inherit'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 색상 테마 */}
              <div className="space-y-2">
                <label className="font-semibold block">색상 테마</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition ${
                      isDark ? 'border-blue-500 bg-blue-500/10 text-blue-400 font-bold' : 'border-inherit'
                    }`}
                  >
                    <Moon className="w-4 h-4" /> 어둡게 (Dark)
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition ${
                      !isDark ? 'border-blue-500 bg-blue-500/10 text-blue-600 font-bold' : 'border-inherit'
                    }`}
                  >
                    <Sun className="w-4 h-4" /> 밝게 (Light)
                  </button>
                </div>
              </div>

              {/* 학습 순서 방식 */}
              <div className="space-y-2">
                <label className="font-semibold block">문장 학습 순서</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsRandomMode(false)}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      !isRandomMode ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                    }`}
                  >
                    순차 진행
                  </button>
                  <button
                    onClick={() => setIsRandomMode(true)}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      isRandomMode ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                    }`}
                  >
                    랜덤 추출
                  </button>
                </div>
              </div>

            </div>

            <button
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition text-sm shadow-md"
            >
              설정 완료
            </button>
          </div>
        </div>
      )}

    </div>
  );
}