"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface VideoPlayerProps {
  slug: string;
  lessonId: string;
  /** Сохранённая позиция (секунды) для продолжения с места. */
  initialPosition: number;
}

export function VideoPlayer({
  slug,
  lessonId,
  initialPosition,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(0);
  const completedRef = useRef(false);
  const resumedRef = useRef(false);

  // Получаем подписанную ссылку на видео
  useEffect(() => {
    let active = true;
    setSrc(null);
    setError(null);
    fetch(
      `/api/video/sign?slug=${encodeURIComponent(slug)}&lessonId=${encodeURIComponent(lessonId)}`,
    )
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Не удалось загрузить видео");
        }
        return r.json();
      })
      .then((d) => {
        if (active) setSrc(d.url);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [slug, lessonId]);

  const saveProgress = useCallback(
    (positionSeconds: number, durationSeconds: number, completed?: boolean) => {
      // Используем keepalive, чтобы запрос успел уйти при закрытии вкладки
      fetch("/api/video/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          slug,
          lessonId,
          positionSeconds,
          durationSeconds,
          completed,
        }),
      }).catch(() => {
        /* тихо игнорируем сетевые сбои сохранения прогресса */
      });
    },
    [slug, lessonId],
  );

  // Восстановление позиции при загрузке метаданных
  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video || resumedRef.current) return;
    resumedRef.current = true;
    if (initialPosition > 0 && initialPosition < video.duration - 5) {
      video.currentTime = initialPosition;
    }
  };

  // Троттлинг сохранения: не чаще раза в 10 секунд
  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video?.duration) return;
    const now = video.currentTime;
    if (Math.abs(now - lastSavedRef.current) >= 10) {
      lastSavedRef.current = now;
      saveProgress(now, video.duration);
    }
  };

  const onEnded = () => {
    const video = videoRef.current;
    if (!video || completedRef.current) return;
    completedRef.current = true;
    saveProgress(video.duration, video.duration, true);
    toast.success("Урок завершён");
  };

  // Сохраняем позицию при уходе со страницы
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video?.duration && !completedRef.current) {
        saveProgress(video.currentTime, video.duration);
      }
    };
  }, [saveProgress]);

  if (error) {
    return (
      <div className="aspect-video rounded-2xl bg-espresso/90 flex flex-col items-center justify-center text-parchment gap-2 px-6 text-center">
        <p className="font-medium">Видео недоступно</p>
        <p className="text-parchment/70 text-sm">{error}</p>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="aspect-video rounded-2xl bg-espresso/90 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-parchment/30 border-t-parchment rounded-full animate-spin" />
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useMediaCaption: видеоуроки без субтитров на текущем этапе
    <video
      ref={videoRef}
      src={src}
      controls
      controlsList="nodownload"
      onContextMenu={(e) => e.preventDefault()}
      onLoadedMetadata={onLoadedMetadata}
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
      className="w-full aspect-video rounded-2xl bg-black"
    />
  );
}
