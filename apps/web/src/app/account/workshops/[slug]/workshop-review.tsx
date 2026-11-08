"use client";

import {
  MAX_REVIEW_PHOTOS,
  type WorkshopReview as Review,
} from "@stariva/web-api/contract";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ConsentCheckbox } from "@/components/stariva/consent-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { reachGoal } from "@/lib/analytics";
import { formErrorMessage, isServerError, webApi } from "@/lib/web-api";
import { compressReviewPhoto } from "@/lib/workshops/review-photo";

interface WorkshopReviewProps {
  slug: string;
  initialReview: Review | null;
  /** Подпись по умолчанию — имя из профиля */
  defaultName: string;
  /** Все уроки просмотрены — зовём показать работу настойчивее */
  courseComplete: boolean;
}

/** Новое фото: файл для отправки и адрес превью в браузере. */
interface NewPhoto {
  file: File;
  preview: string;
}

const RATING_LABELS = [
  "",
  "Плохо",
  "Так себе",
  "Нормально",
  "Хорошо",
  "Отлично",
];

/** Отзыв о мастер-классе в кабинете: форма или уже оставленный отзыв. */
export function WorkshopReview({
  slug,
  initialReview,
  defaultName,
  courseComplete,
}: WorkshopReviewProps) {
  const [review, setReview] = useState(initialReview);
  const [editing, setEditing] = useState(false);

  const showForm = !review || editing;

  return (
    <section
      id="review"
      aria-labelledby="workshop-review-title"
      className="scroll-mt-24 bg-white border border-espresso/10 rounded-2xl p-6"
    >
      <p className="label-caps text-[11px] text-taupe mb-2">Ваш отзыв</p>
      <h3
        id="workshop-review-title"
        className="font-serif text-2xl text-espresso leading-tight mb-2"
      >
        {review && !editing
          ? "Спасибо за отзыв!"
          : courseComplete
            ? "Покажите, что получилось"
            : "Поделитесь впечатлениями"}
      </h3>

      {showForm ? (
        <ReviewForm
          slug={slug}
          review={review}
          defaultName={defaultName}
          onCancel={review ? () => setEditing(false) : undefined}
          onSaved={(saved) => {
            setReview(saved);
            setEditing(false);
          }}
        />
      ) : (
        review && (
          <SavedReview review={review} onEdit={() => setEditing(true)} />
        )
      )}
    </section>
  );
}

function SavedReview({
  review,
  onEdit,
}: {
  review: Review;
  onEdit: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-taupe mb-4">
        {review.status === "published" ? (
          <>
            Отзыв опубликован на{" "}
            <Link href="/reviews" className="text-terracotta hover:underline">
              сайте
            </Link>
            .
          </>
        ) : (
          "Отзыв у Ольги на проверке — после неё он появится на сайте."
        )}
      </p>
      <div className="rounded-xl bg-sand/60 border border-espresso/6 p-4">
        <StarsRow rating={review.rating} />
        <p className="mt-2 font-serif italic text-espresso leading-relaxed whitespace-pre-line">
          &laquo;{review.text}&raquo;
        </p>
        {review.photos.length > 0 && (
          <div className="mt-3 flex gap-2">
            {review.photos.map((src) => (
              // biome-ignore lint/performance/noImgElement: миниатюра фото из отзыва в кабинете
              <img
                key={src}
                src={src}
                alt="Фото из вашего отзыва"
                className="size-20 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-taupe">{review.reviewerName}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-4 text-sm text-terracotta hover:underline"
      >
        Изменить отзыв
      </button>
      {review.status === "published" && (
        <p className="mt-1 text-xs text-taupe">
          Изменённый отзыв Ольга проверит заново, до этого его не будет на
          сайте.
        </p>
      )}
    </div>
  );
}

function ReviewForm({
  slug,
  review,
  defaultName,
  onCancel,
  onSaved,
}: {
  slug: string;
  review: Review | null;
  defaultName: string;
  onCancel?: () => void;
  onSaved: (review: Review) => void;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [text, setText] = useState(review?.text ?? "");
  const [name, setName] = useState(review?.reviewerName ?? defaultName);
  const [keptPhotos, setKeptPhotos] = useState(review?.photos ?? []);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [consent, setConsent] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Превью живут в памяти браузера, пока их не отпустить
  const previews = useRef(newPhotos);
  previews.current = newPhotos;
  // Сжатие идёт дольше, чем форма может прожить: «Отмена» во время него
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const photo of previews.current) URL.revokeObjectURL(photo.preview);
    };
  }, []);

  const photoCount = keptPhotos.length + newPhotos.length;
  const canAddPhoto = photoCount < MAX_REVIEW_PHOTOS;

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_REVIEW_PHOTOS - photoCount;
    const picked = Array.from(files).slice(0, room);
    setPreparing(true);
    setError(null);
    try {
      const compressed: File[] = [];
      for (const file of picked) {
        try {
          compressed.push(await compressReviewPhoto(file));
        } catch {
          setError(
            "Не получилось открыть одно из фото. Выберите снимок в формате JPG или PNG",
          );
        }
      }
      // Форму закрыли, пока шло сжатие: превью некому показать и освободить
      if (!mounted.current) return;
      const added = compressed.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setNewPhotos((current) => [...current, ...added]);
      if (files.length > room) {
        toast.info(`Можно приложить не больше ${MAX_REVIEW_PHOTOS} фото`);
      }
    } finally {
      setPreparing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function removeNewPhoto(photo: NewPhoto) {
    URL.revokeObjectURL(photo.preview);
    setNewPhotos((current) => current.filter((p) => p !== photo));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) return setError("Поставьте оценку");
    if (text.trim().length < 10) {
      return setError("Напишите хотя бы пару предложений");
    }
    if (!name.trim()) return setError("Укажите, как подписать отзыв");
    if (!consent) return setError("Нужно согласие на публикацию отзыва");

    setSaving(true);
    setError(null);
    try {
      const saved = await webApi.account.saveWorkshopReview({
        slug,
        rating,
        text,
        reviewerName: name,
        keepPhotos: keptPhotos,
        photos: newPhotos.map((photo) => photo.file),
        publishConsent: true,
      });
      for (const photo of newPhotos) URL.revokeObjectURL(photo.preview);
      setNewPhotos([]);
      reachGoal(review ? "workshop_review_edit" : "workshop_review_sent", {
        workshop: slug,
        rating,
        photos: saved.photos.length,
      });
      toast.success("Спасибо! Отзыв отправлен Ольге на проверку");
      onSaved(saved);
    } catch (err) {
      setError(
        !isServerError(err)
          ? "Нет связи с сайтом. Проверьте интернет и отправьте ещё раз — текст и фото сохранились в форме"
          : err.code === "UNAUTHORIZED"
            ? "Вы вышли из кабинета. Войдите снова в соседней вкладке и отправьте отзыв ещё раз"
            : formErrorMessage(
                err,
                "Не получилось отправить отзыв. Попробуйте ещё раз",
              ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <p className="text-sm text-taupe">
        Расскажите, как прошло плетение, и приложите фото готовой работы. Ольге
        важно знать, что получилось, а другим — увидеть, что справится и
        новичок.
      </p>

      {/* Пока запрос в пути, править нечего: сервер сохранит то, что ушло,
          а форма после ответа закроется и потеряла бы новые правки */}
      <fieldset
        disabled={saving}
        aria-busy={saving}
        className="space-y-5 min-w-0 transition-opacity disabled:opacity-60"
      >
        <fieldset>
          <legend className="text-sm text-espresso mb-2">Оценка</legend>
          <div className="flex items-center gap-3">
            {/* Нативные радиокнопки: одна остановка Tab на группу, выбор
                стрелками — клавиатура работает без своей обвязки */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className="cursor-pointer p-0.5 text-terracotta transition-transform hover:scale-110 rounded has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-terracotta/50"
                >
                  <input
                    type="radio"
                    name={`${id}-rating`}
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    aria-label={`${value} из 5 — ${RATING_LABELS[value]}`}
                    className="sr-only"
                  />
                  <StarIcon filled={value <= rating} className="size-7" />
                </label>
              ))}
            </div>
            {rating > 0 && (
              <span className="text-sm text-taupe">
                {RATING_LABELS[rating]}
              </span>
            )}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor={`${id}-text`}
            className="block text-sm text-espresso mb-2"
          >
            Отзыв
          </label>
          <Textarea
            id={`${id}-text`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={3000}
            rows={5}
            placeholder="Что понравилось, что было сложно, кому подарили или где повесили"
            className="min-h-32 bg-white"
          />
        </div>

        <div>
          <p className="text-sm text-espresso mb-2">
            Фото работы{" "}
            <span className="text-taupe">
              · до {MAX_REVIEW_PHOTOS}, по желанию
            </span>
          </p>
          <div className="flex flex-wrap gap-3">
            {keptPhotos.map((src) => (
              <PhotoThumb
                key={src}
                src={src}
                onRemove={() =>
                  setKeptPhotos((current) => current.filter((p) => p !== src))
                }
              />
            ))}
            {newPhotos.map((photo) => (
              <PhotoThumb
                key={photo.preview}
                src={photo.preview}
                onRemove={() => removeNewPhoto(photo)}
              />
            ))}
            {canAddPhoto && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={preparing}
                className="size-24 rounded-xl border border-dashed border-espresso/25 text-taupe hover:border-terracotta hover:text-terracotta transition-colors flex flex-col items-center justify-center gap-1 text-xs disabled:opacity-60"
              >
                <span aria-hidden="true" className="text-2xl leading-none">
                  +
                </span>
                {preparing ? "Готовим…" : "Добавить фото"}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => addPhotos(e.target.files)}
          />
        </div>

        <div className="max-w-xs">
          <label
            htmlFor={`${id}-name`}
            className="block text-sm text-espresso mb-2"
          >
            Подпись
          </label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Например, Анна"
            className="bg-white"
          />
          <p className="mt-1 text-xs text-taupe">
            Так отзыв будет подписан на сайте. Достаточно имени.
          </p>
        </div>

        <ConsentCheckbox checked={consent} onCheckedChange={setConsent}>
          Разрешаю опубликовать на сайте stariva.ru мой отзыв, подпись и фото.
          Убрать отзыв можно в любой момент — достаточно написать Ольге.
        </ConsentCheckbox>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={saving || preparing}
          className="bg-terracotta text-parchment hover:bg-terracotta-dark"
        >
          {saving
            ? "Отправляем…"
            : review
              ? "Сохранить отзыв"
              : "Отправить отзыв"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
            className="text-taupe"
          >
            Отмена
          </Button>
        )}
      </div>
    </form>
  );
}

function PhotoThumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative size-24">
      {/* biome-ignore lint/performance/noImgElement: превью выбранного фото */}
      <img
        src={src}
        alt="Фото для отзыва"
        className="size-24 rounded-xl object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Убрать фото"
        className="absolute -top-2 -right-2 size-7 rounded-full bg-espresso text-parchment text-sm leading-none flex items-center justify-center shadow hover:bg-terracotta transition-colors"
      >
        ×
      </button>
    </div>
  );
}

function StarsRow({ rating }: { rating: number }) {
  return (
    <div
      role="img"
      aria-label={`Оценка ${rating} из 5`}
      className="flex gap-0.5 text-terracotta"
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <StarIcon key={value} filled={value <= rating} className="size-4" />
      ))}
    </div>
  );
}

function StarIcon({
  filled,
  className,
}: {
  filled: boolean;
  className: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L5.8 21l1.6-7L2 9.2l7.1-.6L12 2Z" />
    </svg>
  );
}
