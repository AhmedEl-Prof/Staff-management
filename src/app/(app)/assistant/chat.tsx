"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAssistant, type ChatTurn } from "./actions";

export function AssistantChat({ suggestions }: { suggestions: string[] }) {
  const t = useTranslations("assistant");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  function ask(q: string) {
    const clean = q.trim();
    if (!clean || pending) return;
    setError(false);
    setQuestion("");
    startTransition(async () => {
      const result = await askAssistant(turns, clean);
      if (result.text) {
        setTurns((prev) => [...prev, { q: clean, a: result.text! }]);
        setTimeout(
          () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
          50,
        );
      } else {
        setError(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {turns.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
          <p className="text-sm font-medium">{t("suggestionsTitle")}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="hover:bg-muted rounded-full border bg-card px-3 py-1.5 text-sm"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {turns.map((turn, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="bg-primary text-primary-foreground self-end rounded-2xl rounded-ee-sm px-4 py-2 text-sm max-w-[85%]">
              {turn.q}
            </div>
            <div className="bg-card self-start whitespace-pre-wrap rounded-2xl rounded-ss-sm border px-4 py-3 text-sm max-w-[85%]">
              <span className="text-primary mb-1 flex items-center gap-1.5 text-xs font-semibold">
                <Sparkles className="size-3.5" />
                {t("assistantName")}
              </span>
              {turn.a}
            </div>
          </div>
        ))}
        {pending ? (
          <div className="bg-card flex items-center gap-2 self-start rounded-2xl border px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("thinking")}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <p className="text-sm text-destructive">{t("failed")}</p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="sticky bottom-0 flex items-center gap-2 bg-background py-2"
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("placeholder")}
          maxLength={500}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={pending || !question.trim()}
          size="icon"
          aria-label={t("send")}
        >
          <Send className="size-4 rtl:-scale-x-100" />
        </Button>
      </form>
    </div>
  );
}
