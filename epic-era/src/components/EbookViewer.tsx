"use client";

import React, { useState, useEffect, useRef } from "react";

export interface GlossaryTerm {
  term: string;
  english: string;
  definition: string;
}

export interface ChapterData {
  chapter_title: string;
  image_prompt: string;
  image_url: string;
  content: string;
  glossary: GlossaryTerm[];
}

export default function EbookViewer() {
  const [storyChapters, setStoryChapters] = useState<ChapterData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isGeneratingNext, setIsGeneratingNext] = useState<boolean>(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);

  const prefetchLockRef = useRef(false);

  const [storyId, setStoryId] = useState<string>('');
  
  // Ref to prevent double fetching
  const initLockRef = useRef(false);

  // Load from database on mount based on URL story_id
  useEffect(() => {
    if (initLockRef.current) return;
    initLockRef.current = true;

    const params = new URLSearchParams(window.location.search);
    let currentStoryId = params.get("story_id");

    if (!currentStoryId) {
      // Try to restore from localStorage first
      const savedId = localStorage.getItem('wh40k_story_id');
      if (savedId) {
        currentStoryId = savedId;
      } else {
        // Generate new unique ID
        currentStoryId = Math.random().toString(36).substring(2, 10);
      }
      window.history.replaceState({}, '', `/?story_id=${currentStoryId}`);
    }
    
    // Always persist the current story_id to localStorage
    localStorage.setItem('wh40k_story_id', currentStoryId);
    setStoryId(currentStoryId);

    // Fetch story from database
    const loadStory = async () => {
      try {
        const res = await fetch(`/api/story?story_id=${currentStoryId}`);
        const data = await res.json();
        
        if (data.chapters && data.chapters.length > 0) {
          setStoryChapters(data.chapters);
          
          // Restore index from URL hash or fallback to last read position in localStorage
          const savedIndex = parseInt(window.location.hash.replace('#', ''), 10);
          const localIndex = parseInt(localStorage.getItem(`wh40k_index_${currentStoryId}`) || '-1', 10);
          if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex < data.chapters.length) {
            setCurrentIndex(savedIndex);
          } else if (localIndex >= 0 && localIndex < data.chapters.length) {
            setCurrentIndex(localIndex);
          } else {
            setCurrentIndex(data.chapters.length - 1);
          }
          setIsLoadingInitial(false);
          return;
        }
      } catch (e) {
        console.error("Failed to load timeline", e);
      }
      
      // No chapters found or error, fetch the first chapter
      fetchNextChapter([], currentStoryId);
    };

    loadStory();
  }, []);

  // Update hash + localStorage when index changes
  useEffect(() => {
    if (!isLoadingInitial && storyChapters.length > 0) {
      window.history.replaceState({}, '', `/?story_id=${storyId}#${currentIndex}`);
      localStorage.setItem(`wh40k_index_${storyId}`, String(currentIndex));
    }
  }, [currentIndex, storyId, isLoadingInitial, storyChapters.length]);

  // Prefetch logic
  useEffect(() => {
    if (isLoadingInitial) return;

    if (storyChapters.length > 0 && currentIndex === storyChapters.length - 1) {
      // User is at the last downloaded chapter, we must prefetch the next one
      if (!isGeneratingNext && !prefetchLockRef.current) {
        fetchNextChapter(storyChapters, storyId);
      }
    }
  }, [currentIndex, storyChapters.length, isLoadingInitial, isGeneratingNext, storyId]);


  const fetchNextChapter = async (history: ChapterData[], sid: string) => {
    if (prefetchLockRef.current) return;
    prefetchLockRef.current = true;
    setIsGeneratingNext(true);

    try {
      const lastOne = history.slice(-1);
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          storyId: sid,
          historyCount: history.length,
          // Send ALL chapter titles so AI knows what events are already covered
          allChapterTitles: history.map(ch => ch.chapter_title),
          // Send the last chapter with a longer summary to ensure continuity
          lastChapters: lastOne.map(ch => ({ 
            title: ch.chapter_title, 
            contentSummary: ch.content.replace(/<[^>]*>/g, '').substring(0, 600) + "..."
          }))
        })
      });

      if (!response.ok) {
        throw new Error("API failed");
      }

      const newChapter: ChapterData = await response.json();
      setStoryChapters(prev => [...prev, newChapter]);
    } catch (error) {
      console.error("Error generating chapter:", error);
    } finally {
      setIsGeneratingNext(false);
      setIsLoadingInitial(false);
      prefetchLockRef.current = false;
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < storyChapters.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // reliably scroll to top whenever currentIndex changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIndex]);

  const handleReset = () => {
    if (window.confirm("確定要清除所有回憶，將時間線重置回太初之時嗎？")) {
      const newStoryId = Math.random().toString(36).substring(2, 10);
      localStorage.setItem('wh40k_story_id', newStoryId);
      localStorage.removeItem(`wh40k_index_${storyId}`);
      window.location.href = `/?story_id=${newStoryId}`;
    }
  };

  if (isLoadingInitial) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[var(--color-parchment)] font-cinzel text-xl tracking-widest">
        <div className="animate-pulse">連接至沉思者陣列...</div>
      </div>
    );
  }

  const currentChapter = storyChapters[currentIndex];
  if (!currentChapter) return null;

  const isNextDisabled = currentIndex === storyChapters.length - 1;

  const displayImageUrl = currentChapter.image_url;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 md:py-20 flex flex-col gap-12 bg-transparent text-[var(--color-parchment)]">
      {/* Top Bar with Reset */}
      <div className="w-full flex justify-end">
        <button 
          onClick={handleReset}
          className="text-xs text-[#666] border border-[#333] px-3 py-1 hover:text-[var(--color-accent-red)] hover:border-[var(--color-accent-red)] transition-colors"
        >
          [重置時間線]
        </button>
      </div>

      {/* Chapter Title */}
      <h1 className="text-4xl md:text-5xl lg:text-6xl text-center font-cinzel text-[var(--color-accent-red)] border-b border-[#331111] pb-6 drop-shadow-[0_0_15px_rgba(139,0,0,0.5)]">
        {currentChapter.chapter_title}
      </h1>

      {/* Main Illustration */}
      {displayImageUrl && (
        <div className="relative w-full aspect-video md:aspect-[21/9] bg-black border border-[#331111] shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden rounded-sm group">
          <img 
            src={displayImageUrl} 
            alt={currentChapter.chapter_title}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700 ease-in-out"
            onError={(e) => {
              e.currentTarget.src = `https://picsum.photos/seed/fallback/1200/600`; // Static fallback if proxy fails
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        </div>
      )}

      {/* Story Content */}
      <div className="relative z-10 font-noto-serif text-lg md:text-xl leading-relaxed text-[#cbb8a0] tracking-wide markdown-body">
        <div 
          className="prose prose-invert prose-p:text-justify prose-p:mb-6 max-w-none"
          dangerouslySetInnerHTML={{ __html: currentChapter.content }}
        />
      </div>

      {/* Glossary Section */}
      {currentChapter.glossary && currentChapter.glossary.length > 0 && (
        <div className="mt-8 pt-8 border-t border-[#331111]/50 bg-[#0a0a0a] p-6 rounded-sm shadow-inner">
          <h3 className="font-cinzel text-2xl text-[var(--color-accent-red)] mb-4 tracking-wider">Glossary / 知識庫</h3>
          <ul className="space-y-4 font-noto-serif">
            {currentChapter.glossary.map((g, idx) => (
              <li key={idx} className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">
                <span className="text-[var(--color-parchment)] font-bold min-w-max">{g.term}</span>
                <span className="text-xs text-[#888] font-cinzel italic">({g.english})</span>
                <span className="text-[#a89b88] md:ml-2">— {g.definition}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-12 mb-8 select-none">
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="w-full md:w-auto px-8 py-4 font-cinzel tracking-widest text-[#a89b88] border border-[#333] bg-[#111] hover:bg-[#222] hover:text-[var(--color-parchment)] hover:border-[#555] transition-all disabled:opacity-30 disabled:cursor-not-allowed uppercase rounded-sm"
        >
          {'<'} 上一章
        </button>

        <button 
          onClick={handleNext}
          disabled={isNextDisabled}
          className={`w-full md:w-auto px-8 py-4 font-cinzel tracking-widest text-black transition-all uppercase rounded-sm ${
            isNextDisabled 
              ? "bg-[#333] text-[#666] border border-[#222] cursor-not-allowed" 
              : "bg-[var(--color-accent-red)] hover:bg-[#a00000] border border-[#ff3333]/30 shadow-[0_0_15px_rgba(139,0,0,0.4)]"
          }`}
        >
          {isNextDisabled ? "沉思者陣列正在運算..." : "下一章 >"}
        </button>
      </div>
      
    </div>
  );
}
