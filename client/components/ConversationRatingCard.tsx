import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConversationRatingCardProps = {
  title?: string;
  description: string;
  submitLabel?: string;
  acknowledgement?: string;
  onSubmit?: (rating: number) => void | Promise<void>;
};

export function ConversationRatingCard({
  title = "Rate this experience",
  description,
  submitLabel = "Send rating",
  acknowledgement = "Thanks for the rating. This helps Smart Queue keep the experience clearer and calmer.",
  onSubmit,
}: ConversationRatingCardProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit?.(rating);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[1.8rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 text-center shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
          <Star className="h-5 w-5 fill-current" />
        </div>
        <div className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">Rating received</div>
        <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{acknowledgement}</div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.9rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,255,0.92))] p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.75)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.98),rgba(15,23,42,0.98))]">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-amber-500 dark:bg-slate-800/90 dark:text-amber-300">
        <Star className="h-4 w-4 fill-current" />
      </div>
      <div className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</div>
      <div className="mt-5 flex justify-between gap-2">
        {Array.from({ length: 5 }, (_, index) => {
          const value = index + 1;
          const isSelected = rating === value;
          return (
            <button
              key={value}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition ${
                isSelected
                  ? "bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20"
                  : "bg-slate-100 text-slate-600 hover:bg-white hover:text-slate-900 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-600"
              }`}
              onClick={() => setRating(value)}
              type="button"
            >
              {value}
            </button>
          );
        })}
      </div>
      <Button className="site-primary-button mt-5 w-full rounded-full" disabled={!rating || submitting} onClick={handleSubmit}>
        {submitting ? "Sending..." : submitLabel}
      </Button>
    </div>
  );
}
