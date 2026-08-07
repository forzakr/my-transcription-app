'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { lawData } from '@/data/lawData';
import { 
  BookOpen, CheckCircle, Clock, Play, Pause, RotateCcw, 
  ChevronRight, ChevronDown, Sparkles, Award, Settings, Menu, X, Sun, Moon, Eye, EyeOff, HelpCircle, AlertCircle, CornerDownLeft, Shuffle, PanelLeftClose, PanelLeft
} from 'lucide-react';

// 실시간 부분 문자열 유사도(정확도) 계산 함수
function calculateRealtimeAccuracy(userInput, targetText) {
  if (!userInput) return 0;
  const inputTrim = userInput.trim();
  const targetSub = targetText.slice(0, inputTrim.length).trim();
  if (!targetSub) return 0;

  let correctChars = 0;
  const minLen = Math.min(inputTrim.length, targetText.length);
  
  for (let i = 0; i < minLen; i++) {
    if (inputTrim[i] === targetText[i]) {
      correctChars++;
    }
  }

  const accuracy = Math.round((correctChars / inputTrim.length) * 100);
  return Math.min(100, Math.max(0, accuracy));
}

export default function TranscriptionApp() {
  // 기본 학습 상태
  const [selectedItemId, setSelectedItemId] = useState('item-1-1');
  const [openChapters, setOpenChapters] = useState({ ch1: true, ch2: true });
  const [userInput, setUserInput] = useState('');
  const [completedItems, setCompletedItems] = useState({});
  
  // 문장별 누적 필사 횟수 저장 { "item-1-1": 5, "item-1-2": 12, ... }
  const [itemStudyCounts, setItemStudyCounts] = useState({});

  // 정확도 및 상태 제어
  const [accuracy, setAccuracy] = useState(0);
  const [isPass, setIsPass] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);

  // 반복 필사 기능
  const [targetRepeatCount, setTargetRepeatCount] = useState(1);
  const [currentRepeatCount, setCurrentRepeatCount] = useState(0);

  // 데스크톱 사이드바 접기/열기 상태
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // 모바일 UI & 설정 모달
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 사용자 맞춤 설정
  const [theme, setTheme] = useState('dark'); // 어둡게
  const [fontFamily, setFontFamily] = useState('font-sans'); // 고딕체
  const [fontSize, setFontSize] = useState('text-lg'); // 크게
  
  // 랜덤 학습 모드 설정 (On/Off)
  const [isRandomMode, setIsRandomMode] = useState(false);

  // 빈칸 암기모드 설정
  const [useBlankMode, setUseBlankMode] = useState(false);
  const [blankType, setBlankType] = useState('matchLength');

  // 힌트 보기 상태
  const [showHint, setShowHint] = useState(false);

  // ★ [신규] 뽀모도로 타이머 목표 시간 설정 (기본값: 25분)
  const [targetTimerMinutes, setTargetTimerMinutes] = useState(25);
  const [timer, setTimer] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [retrievalSpeed, setRetrievalSpeed] = useState(0);

  // 모든 아이템 평탄화 배열
  const allItems = useMemo(() => lawData.chapters.flatMap(ch => ch.items), []);

  const currentItem = useMemo(() => 
    allItems.find(item => item.id === selectedItemId), [allItems, selectedItemId]
  );

  const currentChapter = useMemo(() => 
    lawData.chapters.find(ch => ch.items.some(item => item.id === selectedItemId)), [selectedItemId]
  );

  // 빈칸 암기 모드 활성화 조건
  const isBlankModeActive = useMemo(() => {
    return useBlankMode && targetRepeatCount > 1 && currentRepeatCount === targetRepeatCount - 1;
  }, [useBlankMode, targetRepeatCount, currentRepeatCount]);

  // 빈칸(OO) 원문 생성 로직
  const displayedLawText = useMemo(() => {
    if (!currentItem) return '';

    if (showHint) {
      return currentItem.law;
    }

    if (isBlankModeActive) {
      const words = currentItem.law.split(' ');
      return words.map((word, idx) => {
        if (idx % 3 === 1 && word.length >= 2) {
          const targetLength = Math.min(word.length, 4);
          const restWord = word.slice(targetLength);
          
          if (blankType === 'fixed') {
            return 'OO' + restWord;
          } else {
            return 'O'.repeat(targetLength) + restWord;
          }
        }
        return word;
      }).join(' ');
    }

    return currentItem.law;
  }, [currentItem, isBlankModeActive, blankType, showHint]);

  // 진도율 및 누적 학습 횟수 복원
  useEffect(() => {
    const savedProgress = localStorage.getItem('transcription_progress');
    if (savedProgress) {
      setCompletedItems(JSON.parse(savedProgress));
    }

    const savedCounts = localStorage.getItem('transcription_study_counts');
    if (savedCounts) {
      setItemStudyCounts(JSON.parse(savedCounts));
    }
  }, []);

  // 뽀모도로 타이머 동작
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0) {
      setIsTimerRunning(false);
      alert(`${targetTimerMinutes}분 몰입 세션이 완료되었습니다!`);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer, targetTimerMinutes]);

  // ★ 타이머 분 설정 변경 시 즉시 카운트다운 초기화
  const handleTimerMinutesChange = (mins) => {
    setTargetTimerMinutes(mins);
    setTimer(mins * 60);
    setIsTimerRunning(false);
  };

  // 실시간 입력 처리
  const handleInputChange = (e) => {
    const val = e.target.value;
    setUserInput(val);

    if (!startTime && val.length > 0) {
      setStartTime(Date.now());
    }

    if (startTime && val.length > 5) {
      const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
      const speed = Math.round(val.length / elapsedMinutes);
      setRetrievalSpeed(speed);
    }

    if (!currentItem) return;

    const realAcc = calculateRealtimeAccuracy(val, currentItem.law);
    setAccuracy(realAcc);

    if (val.length >= currentItem.law.length - 3) {
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

  // 다음 문장 결정 함수 (순차 vs 랜덤)
  const getNextItemId = () => {
    if (isRandomMode) {
      const otherItems = allItems.filter(item => item.id !== selectedItemId);
      if (otherItems.length === 0) return selectedItemId;
      const randomIndex = Math.floor(Math.random() * otherItems.length);
      return otherItems[randomIndex].id;
    } else {
      const currentIndex = allItems.findIndex(item => item.id === selectedItemId);
      if (currentIndex < allItems.length - 1) {
        return allItems[currentIndex + 1].id;
      }
      return null;
    }
  };

  // 엔터 키 입력 시 완료/다음 진행
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (isPass && currentItem) {
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
          setShowHint(false);
        } else {
          const updatedProgress = { ...completedItems, [currentItem.id]: true };
          setCompletedItems(updatedProgress);
          localStorage.setItem('transcription_progress', JSON.stringify(updatedProgress));

          const nextId = getNextItemId();
          if (nextId) {
            setSelectedItemId(nextId);
            setUserInput('');
            setCurrentRepeatCount(0);
            setAccuracy(0);
            setIsPass(false);
            setStartTime(null);
            setShowHint(false);
          } else {
            alert('🎉 모든 학습 문장을 완료하셨습니다!');
          }
        }
      } else if (userInput.length >= (currentItem?.law.length || 0) - 3) {
        setShowErrorAlert(true);
      }
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItemId(id);
    setUserInput('');
    setCurrentRepeatCount(0);
    setAccuracy(0);
    setIsPass(false);
    setShowErrorAlert(false);
    setStartTime(null);
    setRetrievalSpeed(0);
    setShowHint(false);
    setIsSidebarOpen(false);
  };

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
    <div className={`flex h-screen w-full font-sans overflow-hidden transition-colors duration-200 ${bgMain}`}>
      
      {/* 모바일 헤더 */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 border-b border-slate-700/50 flex items-center justify-between px-4 z-40 bg-slate-950/80 backdrop-blur">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-lg bg-slate-800/50 text-slate-200 hover:bg-slate-800"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <span className="font-bold text-sm tracking-tight text-slate-200">민법 기출 필사</span>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-lg bg-slate-800/50 text-slate-200 hover:bg-slate-800"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* 1. 사이드바 (트리 목차) */}
      {isSidebarVisible && (
        <aside 
          className={`fixed md:static top-14 md:top-0 bottom-0 left-0 z-30 w-72 md:w-80 border-r flex flex-col transition-all duration-300 ${bgSidebar} ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="p-4 border-b border-inherit hidden md:flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="text-blue-500 w-5 h-5" />
              <h1 className="font-bold text-sm tracking-wide">민법 기출 필사</h1>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className={`p-1.5 rounded-lg hover:bg-slate-800/20 transition ${textMuted}`}
                title="설정"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsSidebarVisible(false)}
                className={`p-1.5 rounded-lg hover:bg-slate-800/20 transition ${textMuted}`}
                title="목차 숨기기"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {lawData.chapters.map((chapter) => (
              <div key={chapter.id} className="space-y-1">
                <button
                  onClick={() => setOpenChapters(prev => ({ ...prev, [chapter.id]: !prev[chapter.id] }))}
                  className={`w-full flex items-center justify-between p-2 font-semibold rounded transition ${textMuted} hover:bg-blue-500/10 ${fontSize}`}
                >
                  <span className="truncate">{chapter.title}</span>
                  {openChapters[chapter.id] ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                </button>

                {openChapters[chapter.id] && (
                  <div className="pl-3 space-y-1 border-l border-inherit ml-2">
                    {chapter.items.map((item) => {
                      const isSelected = item.id === selectedItemId;
                      const isDone = completedItems[item.id];
                      const totalCount = itemStudyCounts[item.id] || 0;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectItem(item.id)}
                          className={`w-full flex items-center justify-between p-2 rounded transition-all ${fontSize} ${
                            isSelected 
                              ? 'bg-blue-600 text-white font-medium shadow-sm' 
                              : `${textMuted} hover:bg-slate-500/10`
                          }`}
                        >
                          <span className="truncate">{item.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {totalCount > 0 && (
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                                isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {totalCount}회
                              </span>
                            )}
                            {isDone && <CheckCircle className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />}
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
            <div className={`flex justify-between text-xs mb-1 ${textMuted}`}>
              <span>학습 진도율</span>
              <span>
                {Math.round((Object.keys(completedItems).length / allItems.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-700/30 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${(Object.keys(completedItems).length / allItems.length) * 100}%` }}
              />
            </div>
          </div>
        </aside>
      )}

      {isSidebarOpen && (
        <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />
      )}

      {/* 2. 메인 화면 */}
      <div className="flex-1 flex flex-col h-full pt-14 md:pt-0 overflow-hidden">
        
        <header className={`h-14 border-b border-inherit px-4 md:px-6 flex items-center justify-between shrink-0 ${bgSidebar}`}>
          <div className="flex items-center gap-3">
            {!isSidebarVisible && (
              <button
                onClick={() => setIsSidebarVisible(true)}
                className={`hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-inherit hover:bg-slate-500/10 transition ${textMuted}`}
                title="목차 펼치기"
              >
                <PanelLeft className="w-4 h-4 text-blue-500" />
                <span>목차 열기</span>
              </button>
            )}

            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
              <span>{currentChapter?.title}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="font-medium text-blue-500">{currentItem?.title}</span>
            </div>
          </div>

          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            {isRandomMode && (
              <div className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full font-medium">
                <Shuffle className="w-3 h-3" />
                <span>랜덤 모드</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-full font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{retrievalSpeed} 자/분</span>
            </div>

            {/* 타이머 컨트롤 */}
            <div className="flex items-center gap-2 text-xs bg-slate-500/10 px-3 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-mono font-bold">{formatTime(timer)}</span>
              <button onClick={() => setIsTimerRunning(!isTimerRunning)} className="hover:text-blue-500 transition ml-1" title={isTimerRunning ? "일시정지" : "시작"}>
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={() => { 
                  setIsTimerRunning(false); 
                  setTimer(targetTimerMinutes * 60); 
                }} 
                className="hover:text-slate-400 transition"
                title="타이머 리셋"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-inherit pb-3">
            <div>
              <h2 className="text-lg md:text-xl font-bold">{currentItem?.title}</h2>
              <p className={`text-xs mt-0.5 ${textMuted}`}>
                {isBlankModeActive ? '★ 빈칸 암기 모드: 빈칸에 들어갈 단어를 떠올리며 원문을 입력하세요.' : '원문을 따라 쓰며 정밀 필사 학습을 진행하세요.'}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="bg-slate-500/10 px-3 py-1.5 rounded-lg border border-inherit text-xs font-medium">
                <span className={textMuted}>누적 학습: </span>
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

          <div className={`p-4 md:p-6 rounded-2xl border ${bgCard} space-y-4`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                {isBlankModeActive ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
                {isBlankModeActive ? '원문 (빈칸 암기 모드)' : '법리 원문'}
              </span>

              {isBlankModeActive && (
                <button
                  onMouseDown={() => setShowHint(true)}
                  onMouseUp={() => setShowHint(false)}
                  onTouchStart={() => setShowHint(true)}
                  onTouchEnd={() => setShowHint(false)}
                  onClick={() => setShowHint(!showHint)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 transition font-medium select-none"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  {showHint ? '힌트 숨기기' : '힌트 보기 (눌러서 확인)'}
                </button>
              )}
            </div>
            
            {/* 원문 출력 */}
            <div className={`p-4 rounded-xl border border-inherit leading-relaxed select-none ${
              isBlankModeActive 
                ? showHint 
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-medium' 
                  : 'bg-amber-500/10 border-amber-500/30 font-bold text-amber-600 dark:text-amber-400' 
                : 'bg-slate-500/5'
            } ${fontFamily} ${fontSize}`}>
              {displayedLawText}
            </div>

            {/* 입력창 및 안내 메시지 */}
            <div className="space-y-2">
              <textarea
                value={userInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isBlankModeActive ? "빈칸을 완성하여 입력 후 Enter를 누르세요..." : "위 원문과 똑같이 입력 후 Enter를 누르세요..."}
                className={`w-full h-32 p-4 rounded-xl border transition focus:outline-none focus:ring-2 resize-none ${
                  isPass 
                    ? 'border-emerald-500 focus:ring-emerald-500/50' 
                    : showErrorAlert 
                      ? 'border-rose-500/80 focus:ring-rose-500/50' 
                      : 'border-slate-700 focus:ring-blue-500/50'
                } ${bgInput} ${fontFamily} ${fontSize}`}
              />
              
              {/* 통과 알림 */}
              {isPass && (
                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-xs font-medium animate-bounce">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    작성 완수! (정확도 {accuracy}%) 다음 문장으로 가려면 <strong>Enter 키</strong>를 누르세요.
                  </span>
                  <CornerDownLeft className="w-4 h-4" />
                </div>
              )}

              {/* 90% 미만 경고 */}
              {showErrorAlert && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>현재 정확도 <strong>{accuracy}%</strong> 입니다. 오탈자를 확인해 주세요 (90% 이상 작성 후 Enter).</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                <span>입력 완료 후 Enter를 눌러 진행하세요.</span>
                <span className="font-mono font-medium">실시간 정확도: {accuracy}% | {userInput.length} / {currentItem?.law.length} 자</span>
              </div>
            </div>
          </div>

          {/* 1:1 사례 적용 카드 */}
          <div className={`p-4 md:p-6 rounded-2xl border ${bgCard} space-y-2`}>
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">1:1 사례 적용</span>
            <p className={`leading-relaxed ${textMuted} ${fontFamily} ${fontSize}`}>
              {currentItem?.example}
            </p>
          </div>

        </main>
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

            <div className="space-y-4 text-xs md:text-sm">
              
              {/* ★ [신규] 뽀모도로 타이머 목표 시간 설정 */}
              <div className="space-y-2">
                <label className="font-semibold block flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-500" /> 뽀모도로 타이머 시간
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[15, 20, 25, 30, 50, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleTimerMinutesChange(mins)}
                      className={`p-2.5 rounded-xl border text-center font-mono transition ${
                        targetTimerMinutes === mins ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                      }`}
                    >
                      {mins}분
                    </button>
                  ))}
                </div>
              </div>

              {/* 테마 설정 */}
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

              {/* 학습 순서 방식 (순차 vs 랜덤) */}
              <div className="space-y-2">
                <label className="font-semibold block">문장 학습 순서</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsRandomMode(false)}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      !isRandomMode ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                    }`}
                  >
                    순차 진행 (기본)
                  </button>
                  <button
                    onClick={() => setIsRandomMode(true)}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      isRandomMode ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                    }`}
                  >
                    랜덤 추출 (Random)
                  </button>
                </div>
              </div>

              {/* 빈칸 암기 모드 설정 */}
              <div className="space-y-2">
                <label className="font-semibold block">마지막 횟수 빈칸 암기 모드</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setUseBlankMode(true)}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      useBlankMode ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                    }`}
                  >
                    사용함 (ON)
                  </button>
                  <button
                    onClick={() => setUseBlankMode(false)}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      !useBlankMode ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                    }`}
                  >
                    사용 안 함 (OFF)
                  </button>
                </div>
              </div>

              {useBlankMode && (
                <div className="space-y-2">
                  <label className="font-semibold block">빈칸 표시 방식</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBlankType('fixed')}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        blankType === 'fixed' ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                      }`}
                    >
                      고정 표시 (OO)
                    </button>
                    <button
                      onClick={() => setBlankType('matchLength')}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        blankType === 'matchLength' ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                      }`}
                    >
                      글자 수 맞춤 (OOOO)
                    </button>
                  </div>
                </div>
              )}

              {/* 글자 크기 설정 */}
              <div className="space-y-2">
                <label className="font-semibold block">글자 크기 (전체 반영)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '작게', val: 'text-sm' },
                    { label: '보통', val: 'text-base' },
                    { label: '크게', val: 'text-lg' },
                    { label: '매우크게', val: 'text-xl' }
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => setFontSize(item.val)}
                      className={`p-2 rounded-xl border text-center transition ${
                        fontSize === item.val ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 폰트 스타일 */}
              <div className="space-y-2">
                <label className="font-semibold block">폰트 스타일</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '바탕체 (Serif)', val: 'font-serif' },
                    { label: '고딕체 (Sans)', val: 'font-sans' },
                    { label: '고정폭 (Mono)', val: 'font-mono' }
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => setFontFamily(item.val)}
                      className={`p-2 rounded-xl border text-center transition ${
                        fontFamily === item.val ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 목표 반복 횟수 */}
              <div className="space-y-2">
                <label className="font-semibold block">목표 문장 반복 횟수</label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        setTargetRepeatCount(num);
                        setCurrentRepeatCount(0);
                        setShowHint(false);
                      }}
                      className={`p-2 rounded-xl border text-center transition ${
                        targetRepeatCount === num ? 'border-blue-500 bg-blue-500/10 font-bold text-blue-500' : 'border-inherit'
                      }`}
                    >
                      {num}회
                    </button>
                  ))}
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