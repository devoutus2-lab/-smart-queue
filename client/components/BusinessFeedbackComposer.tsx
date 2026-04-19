import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Frown, Meh, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

type BusinessFeedbackComposerProps = {
  businessId: number;
  visitId: number;
  onSubmitted?: () => Promise<void> | void;
};

export function BusinessFeedbackComposer({ businessId, visitId, onSubmitted }: BusinessFeedbackComposerProps) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const scope = getAccountScope(user);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  const submitFeedback = useMutation({
    mutationFn: () => api.submitFeedback({ businessId, visitId, rating, comment }),
    onSuccess: async () => {
      setComment("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business", businessId] }),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.visitHistory(scope.userId) }),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(scope.userId) }),
      ]);
      await onSubmitted?.();
    },
  });

  return (
    <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.8)] dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-6 gap-3 text-sm">
        <div className="col-span-6">
          <div className="text-center text-xl font-bold text-slate-900 dark:text-slate-100">Send Feedback</div>
          <p className="mt-2 text-center text-sm leading-6 text-slate-500 dark:text-slate-400">
            Share what the visit felt like and leave a rating other guests can trust.
          </p>
        </div>

        <textarea
          className="col-span-6 h-28 resize-none rounded-lg border border-slate-200 bg-slate-100 p-3 text-slate-600 outline-none transition duration-300 placeholder:text-slate-500 focus:border-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400"
          placeholder="Your feedback..."
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />

        <button
          className={`col-span-1 flex items-center justify-center rounded-lg border bg-slate-100 p-2 transition duration-300 ${
            rating >= 4
              ? "border-blue-400 bg-blue-500 text-blue-100"
              : "border-slate-200 text-slate-600 hover:border-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
          onClick={() => setRating(5)}
          type="button"
        >
          <Smile className="h-5 w-5" />
        </button>
        <button
          className={`col-span-1 flex items-center justify-center rounded-lg border bg-slate-100 p-2 transition duration-300 ${
            rating === 3
              ? "border-blue-400 bg-blue-500 text-blue-100"
              : "border-slate-200 text-slate-600 hover:border-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
          onClick={() => setRating(3)}
          type="button"
        >
          <Meh className="h-5 w-5" />
        </button>
        <button
          className={`col-span-1 flex items-center justify-center rounded-lg border bg-slate-100 p-2 transition duration-300 ${
            rating <= 2
              ? "border-blue-400 bg-blue-500 text-blue-100"
              : "border-slate-200 text-slate-600 hover:border-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
          onClick={() => setRating(1)}
          type="button"
        >
          <Frown className="h-5 w-5" />
        </button>
        <span className="col-span-3" />
        <div className="col-span-6 rounded-[1.7rem] bg-[hsl(213,19%,18%)] p-5 text-white">
          <div className="text-xl font-bold">How did it go?</div>
          <p className="mt-3 text-sm leading-6 text-[hsl(217,12%,63%)]">
            Rate the timing, courtesy, and overall visit experience before sending your review.
          </p>
          <div className="mt-5 flex justify-between gap-2" onMouseLeave={() => setHoveredRating(null)}>
            {Array.from({ length: 5 }, (_, index) => {
              const value = index + 1;
              const isSelected = rating === value;
              const isPreviewed = value <= (hoveredRating ?? rating);

              return (
                <div key={value}>
                  <input
                    checked={isSelected}
                    className="sr-only"
                    id={`business-rating-${visitId}-${value}`}
                    name={`business-rating-${visitId}`}
                    onChange={() => setRating(value)}
                    type="radio"
                    value={value}
                  />
                  <label
                    className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-sm transition ${
                      isSelected
                        ? "bg-[hsl(25,97%,53%)] font-semibold text-[hsl(213,19%,18%)]"
                        : isPreviewed
                          ? "bg-white text-[hsl(213,19%,18%)]"
                          : "bg-[hsla(217,12%,63%,0.4)] text-white"
                    }`}
                    htmlFor={`business-rating-${visitId}-${value}`}
                    onMouseEnter={() => setHoveredRating(value)}
                  >
                    {value}
                  </label>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex justify-center">
            <div className="rounded-full bg-[hsl(217,12%,63%)] px-5 py-1.5 text-sm text-[hsl(25,97%,53%)]">
              Selected {rating} of 5
            </div>
          </div>
        </div>
        <Button
          className="col-span-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 hover:bg-blue-400 hover:text-white dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900"
          disabled={comment.trim().length < 2 || submitFeedback.isPending}
          onClick={() => submitFeedback.mutate()}
        >
          <Send className="mr-2 h-4 w-4" />
          {submitFeedback.isPending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
