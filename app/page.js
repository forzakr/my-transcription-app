'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { lawData } from '@/data/lawData';
import { 
  BookOpen, CheckCircle, Clock, Play, Pause, RotateCcw, 
  ChevronRight, ChevronDown, Settings, Menu, X, Sun, Moon, Eye, EyeOff, HelpCircle, AlertCircle, CornerDownLeft, PanelLeftClose, PanelLeft, Maximize, Minimize, Plus, Minus, Coffee, ArrowLeft, ArrowRight, Lightbulb, Keyboard, Trash2
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

// 한글, 영어, 숫자만 남기는 정규화 함수 (띄어쓰기/특수문자 제외)
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

  // ★ [신규] TAB 키로 언제든 여닫는 해설 패널 토글 상태
  const [showExplanation, setShowExplanation] = useState(false);

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

  // 학습 순서 (순차 vs 랜덤)
  const [isRandomMode, setIsRandomMode] = useState(false);
  
  // 학습 모드 3가지: 'normal'(일반필사) | 'chosung'(초성필사) | 'blank'(빈칸암기)
  const [studyMode, setStudyMode] = useState('normal'); 
  const [modeTiming, setModeTiming] = useState('all'); 
  const [blankType, setBlankType] = useState('matchLength');

  // 토글형 힌트 상태
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

  // 변형 모드 적용 타이밍 판별
  const isSpecialModeActive = useMemo(() => {
    if (studyMode === 'normal') return false;
    if (modeTiming === 'all') return true;
    if (modeTiming === 'last') {
      return targetRepeatCount === 1 ? true : currentRepeatCount === targetRepeatCount - 1;
    }
    return false;
  }, [studyMode, modeTiming, targetRepeatCount, currentRepeatCount]);

  // 원문 출력 텍스트 연산
  const displayedLawText = useMemo(() => {
    if (!currentItem) return '';
    if (showFullAnswer) return currentItem.law;

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

    if (showChosungHint) {
      return getChosung(currentItem.law);
    }

    return currentItem.law;
  }, [currentItem, isSpecialModeActive, studyMode, showChosungHint, showFullAnswer, blankType]);

  // LocalStorage 데이터 복원 (이전 학습 상태 이어가기)
  useEffect(() => {
    const savedProgress = localStorage.getItem('transcription_progress');
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress);
      setCompletedItems(parsed);
      
      // 저장된 마지막 학습 위치 복원
      const savedLastItem = localStorage.getItem('transcription_last_item');
      if (savedLastItem && allItems.some(it => it.id === savedLastItem)) {
        setSelectedItemId(savedLastItem);
      }
    }

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
  }, [allItems]);

  // 문장 이동 시 마지막 문장 ID 저장
  useEffect(() => {
    if (selectedItemId) {
      localStorage.setItem('transcription_last_item', selectedItemId);
    }
  }, [selectedItemId]);

  // 뽀모도로 타이머
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(s => s - 1), 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      if (timerMode === 'study') {
        alert(`🎉 ${studyTimeSetting}분 집중 학습 완료! ${restTimeSetting}분 휴식 시작!`);
        setTimerMode('rest');
        setTimerSeconds(restTimeSetting * 60);
      } else {
        alert(`☕ ${restTimeSetting}분 휴식 종료! 다시 집중 학습 시작!`);
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

  // ★ [1번 요구사항] 학습 진행상황 초기화 (개별 문장 횟수는 보존하고, 미완료 목록 리셋)
  const handleResetProgress = () => {
    if (window.confirm('오늘의 학습 진행도(완료 체크)를 초기화하시겠습니까?\n(※ 개별 문장의 누적 필사 횟수는 그대로 유지됩니다.)')) {
      setCompletedItems({});
      localStorage.removeItem('transcription_progress');
      setCurrentRepeatCount(0);
      setUserInput('');
      setAccuracy(0);
      setIsPass(false);
      setShowExplanation(false);
      
      // 첫 번째 문장으로 초기화 이동
      if (allItems.length > 0) {
        setSelectedItemId(allItems[0].id);
      }
    }
  };

  // ★ [1번 요구사항] 중복 없는 랜덤 추출 & 순차 다음 문장 로직
  const getNextItemId = useCallback(() => {
    if (isRandomMode) {
      // 아직 완료하지 않은 문장들만 필터링 (중복 방지 큐)
      const remainingItems = allItems.filter(item => !completedItems[item.id] && item.id !== selectedItemId);
      
      if (remainingItems.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingItems.length);
        return remainingItems[randomIndex].id;
      } else {
        // 모든 문장을 다 완료한 경우, 현재 문장을 제외한 전체 중에서 랜덤
        const otherItems = allItems.filter(item => item.id !== selectedItemId);
        if (otherItems.length === 0) return selectedItemId;
        return otherItems[Math.floor(Math.random() * otherItems.length)].id;
      }
    } else {
      const currentIndex = allItems.findIndex(item => item.id === selectedItemId);
      return currentIndex < allItems.length - 1 ? allItems[currentIndex + 1].id : null;
    }
  }, [allItems, completedItems, isRandomMode, selectedItemId]);

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
    setShowExplanation(false);
    setIsSidebarOpen(false);
  }, []);

  // 실시간 입력 처리
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

  // 다음 문장/반복 진행
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
      setShowExplanation(false);
    } else {
      const updatedProgress = { ...completedItems, [currentItem.id]: true };
      setCompletedItems(updatedProgress);
      localStorage.setItem('transcription_progress', JSON.stringify(updatedProgress));

      const nextId = getNextItemId();
      if (nextId) {
        handleSelectItem(nextId);
      } else {
        alert('🎉 모든 학습 문장을 중복 없이 완수하셨습니다!');
      }
    }
  }, [currentItem, itemStudyCounts, currentRepeatCount, targetRepeatCount, completedItems, getNextItemId, handleSelectItem]);

  // ★ [3번 요구사항] Tab 키로 해설 열기/닫기 & Enter 키로 다음 진행
  const handleKeyDown = (e) => {
    // 1) Tab 키 누르면 언제든지 해설 패널 토글 (기본 포커스 이동 방지)
    if (e.key === 'Tab') {
      e.preventDefault();
      setShowExplanation(prev => !prev);
      return;
    }

    // 2) 통과 상태에서 Enter 누르면 바로 다음으로 이동
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (isPass) {
        proceedNextStep();
      } else if (sanitizeText(userInput).length >= sanitizeText(currentItem?.law || '').length - 2) {
        setShowErrorAlert(true);
      }
    }
  };

  // 글로벌 단축키
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Tab 키 전역 토글 (입력창 밖에서도 작동)
      if (e.key === 'Tab' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setShowExplanation(prev => !prev);
        return;
      }

      if ((e.ctrlKey || e.altKey) && e.code === 'Space') {
        e.preventDefault();
        setShowChosungHint(prev => !prev);
        return;
      }

      const isInputActive = document.activeElement?.tagName === 'TEXTAREA';
      if (!isInputActive) {
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
  }, [getPrevItemId, getNextItemId, handleSelectItem]);

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

      {/* 1. 사이드바 (목차 & 진도 초기화) */}
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

          {/* 진도율 & 초기화 버튼 */}
          <div className="p-4 border-t border-inherit bg-inherit space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className={`font-medium ${textMuted}`}>학습 완료 진도</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-500">
                  {Object.keys(completedItems).length} / {allItems.length} ({Math.round((Object.keys(completedItems).length / allItems.length) * 100)}%)
                </span>
                <button
                  onClick={handleResetProgress}
                  className="p-1 text-slate-400 hover:text-rose-500 transition"
                  title="진도 초기화"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
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
        
        <header className={`h-16 border-b border-inherit px-4 md:px-6 flex items-center justify-between shrink-0 ${bgSidebar}`}>
          <div className="flex items-center gap-3">
            {!isSidebarVisible && (
              <button onClick={() => setIsSidebarVisible(true)} className={`hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-inherit hover:bg-slate-500/10 ${textMuted}`}>
                <PanelLeft className="w-4 h-4 text-blue-500" />
                <span>목차 열기</span>
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSelectItem(getPrevItemId())}
                disabled={!getPrevItemId()}
                className={`flex items-center gap-1 text-xs px-3 py-2 rounded-xl border border-inherit transition ${
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
                className={`flex items-center gap-1 text-xs px-3 py-2 rounded-xl border border-inherit transition ${
                  getNextItemId() ? 'hover:bg-slate-500/10 text-slate-200' : 'opacity-40 cursor-not-allowed text-slate-500'
                }`}
                title="다음 문장 (단축키: →)"
              >
                <span className="hidden sm:inline">다음 문장</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ★ [2번 요구사항] 가독성이 대폭 향상된 대형 뽀모도로 시계 & 설정 버튼 */}
          <div className="flex items-center gap-2 md:gap-3">
            
            {/* 고시인성 뽀모도로 타이머 */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border transition-all ${
              timerMode === 'study' 
                ? 'bg-blue-950/60 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/20' 
                : 'bg-amber-950/60 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/20'
            }`}>
              <div className="flex items-center gap-1.5">
                {timerMode === 'study' ? <Clock className="w-4 h-4 text-blue-400 animate-pulse" /> : <Coffee className="w-4 h-4 text-amber-400" />}
                <span className="text-xs font-black uppercase tracking-wider hidden md:inline">
                  {timerMode === 'study' ? '집중' : '휴식'}
                </span>
              </div>
              
              <span className="font-mono font-black text-base md:text-lg tracking-tight text-white drop-shadow">
                {formatTime(timerSeconds)}
              </span>
              
              <div className="flex items-center gap-1 border-l border-inherit pl-2 ml-1">
                <button 
                  onClick={() => setIsTimerRunning(!isTimerRunning)} 
                  className={`p-1 rounded-lg hover:bg-white/10 transition ${isTimerRunning ? 'text-amber-400' : 'text-emerald-400'}`}
                  title={isTimerRunning ? "일시정지" : "시작"}
                >
                  {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => { 
                    setIsTimerRunning(false); 
                    setTimerSeconds((timerMode === 'study' ? studyTimeSetting : restTimeSetting) * 60); 
                  }} 
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                  title="타이머 리셋"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 설정 버튼 */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`p-2 rounded-xl border border-inherit hover:bg-slate-500/10 transition font-medium ${textMuted}`}
              title="학습 환경 설정"
            >
              <Settings className="w-4 h-4 text-blue-500" />
            </button>

            {/* 전체화면 버튼 */}
            <button
              onClick={toggleFullscreen}
              className={`p-2 rounded-xl border border-inherit hover:bg-slate-500/10 transition ${textMuted}`}
              title={isFullscreen ? "전체화면 해제" : "전체화면 전환"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4 text-amber-500" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6 pb-20">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-inherit pb-3">
            <div>
              <h2 className="text-lg md:text-xl font-bold">{currentItem?.title}</h2>
              <p className={`text-xs mt-0.5 ${textMuted}`}>
                {isSpecialModeActive 
                  ? studyMode === 'blank' ? '★ 빈칸 암기 모드: 주요 단어를 떠올리며 원문을 완성하세요.' : '★ 초성 힌트 모드: 초성 힌트를 보며 원문을 입력하세요.'
                  : '원문을 올바르게 따라 쓰며 몰입 필사를 진행하세요.'}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="bg-slate-500/10 px-3 py-1.5 rounded-lg border border-inherit text-xs font-medium">
                <span className={textMuted}>누적 완수: </span>
                <span className="font-bold text-emerald-500 font-mono">{itemStudyCounts[currentItem?.id] || 0}회</span>
              </div>

              <div className="bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 text-xs">
                <span className="text-blue-500 font-medium">진행: </span>
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-sm">
                  {currentRepeatCount + 1} / {targetRepeatCount} 회
                </span>
              </div>
            </div>
          </div>

          {/* 학습 원문 카드 */}
          <div className={`p-4 md:p-6 rounded-2xl border ${bgCard} space-y-4`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                {isSpecialModeActive ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
                {isSpecialModeActive ? (studyMode === 'blank' ? '학습 원문 (빈칸 모드)' : '학습 원문 (초성 모드)') : '학습 원문'}
              </span>

              {/* 힌트 및 정답 보기, 해설 토글 버튼 */}
              <div className="flex items-center gap-2">
                
                {/* ★ [3번 요구사항] Tab 키 연동 해설 토글 버튼 */}
                <button
                  onClick={() => setShowExplanation(prev => !prev)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition font-medium select-none ${
                    showExplanation 
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="단축키: TAB 키"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>해설 (Tab)</span>
                </button>

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

            {/* ★ [3번 요구사항] 언제든 Tab 키로 즉시 펼쳐지는 인라인 해설 패널 */}
            {showExplanation && (
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2 animate-fadeIn transition-all">
                <div className="flex items-center justify-between text-amber-500 text-xs font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4" /> 핵심 해설 & 적용
                  </span>
                  <span className="text-[11px] font-normal text-amber-400/80">Tab 키를 누르면 닫힙니다</span>
                </div>
                <p 
                  className={`leading-relaxed text-slate-200 ${fontFamily}`}
                  style={{ fontSize: `${Math.max(15, fontSizePx - 1)}px` }}
                >
                  {currentItem?.example || '등록된 추가 해설이 없습니다.'}
                </p>
              </div>
            )}

            {/* 입력 영역 */}
            <div className="space-y-2">
              <textarea
                value={userInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isSpecialModeActive ? "원문 전체를 정확히 입력 후 Enter를 누르세요... (해설 확인: Tab)" : "위 원문과 일치하도록 입력 후 Enter를 누르세요... (해설 확인: Tab)"}
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
                    작성 완료! (일치율 {accuracy}%) <strong>Enter 키</strong>를 누르면 다음 문장으로 바로 이동합니다.
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
                <span>실시간 정확도 판별 중 (Tab: 해설 열기/닫기)</span>
                <span className="font-mono font-medium">문자 일치율: {accuracy}%</span>
              </div>
            </div>
          </div>

        </main>

        {/* 하단 단축키 안내 바 */}
        <footer className={`fixed bottom-0 left-0 right-0 h-10 border-t border-inherit px-4 flex items-center justify-between z-20 text-xs ${bgSidebar}`}>
          <div className="flex items-center gap-4 text-slate-400 overflow-x-auto py-1">
            <span className="flex items-center gap-1 font-semibold text-blue-400 shrink-0">
              <Keyboard className="w-3.5 h-3.5" /> 단축키:
            </span>
            <span className="shrink-0"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">Tab</kbd> 해설 열기/닫기</span>
            <span className="shrink-0"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">← / →</kbd> 문장 이동</span>
            <span className="shrink-0"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">Ctrl + Space</kbd> 초성 힌트</span>
            <span className="shrink-0"><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">Enter</kbd> 다음 문장 진행</span>
          </div>
        </footer>

      </div>

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
              
              {/* 학습 진도 초기화 버튼 */}
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-rose-400 block">오늘의 학습 진행도 초기화</span>
                  <span className="text-[11px] text-slate-400">완료 체크를 리셋하여 중복 없이 다시 처음부터 진행합니다.</span>
                </div>
                <button
                  onClick={() => {
                    handleResetProgress();
                    setIsSettingsOpen(false);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition text-xs shrink-0"
                >
                  초기화
                </button>
              </div>

              {/* 학습 모드 선택 */}
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

              {/* 문장 학습 순서 (순차 vs 랜덤) */}
              <div className="space-y-2">
                <label className="font-semibold block">문장 출제 순서</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsRandomMode(false)}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      !isRandomMode ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                    }`}
                  >
                    순차 진행 (목차 순)
                  </button>
                  <button
                    onClick={() => setIsRandomMode(true)}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      isRandomMode ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                    }`}
                  >
                    랜덤 추출 (중복 없음)
                  </button>
                </div>
              </div>

              {/* 뽀모도로 타이머 직접 입력 */}
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