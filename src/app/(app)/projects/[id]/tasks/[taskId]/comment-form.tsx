"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment } from "../relations-actions";

export interface Mentionable {
  id: string;
  // Token used in the @ syntax (no spaces) — falls back to a slug of the name.
  handle: string;
  label: string;
}

// Comment composer with simple @-mention support. As the user types, when the
// last token starts with "@" we surface a list of matching project members;
// picking one inserts the handle and records the user id as a hidden mentions
// input that the server action will store on the comment row.
export function CommentForm({
  projectId,
  taskId,
  mentionables,
}: {
  projectId: string;
  taskId: string;
  mentionables: Mentionable[];
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [content, setContent] = useState("");
  const [caret, setCaret] = useState(0);
  const [mentionIds, setMentionIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  // The token immediately to the left of the caret, if it starts with @.
  const activeQuery = useMemo(() => {
    const end = Math.min(caret, content.length);
    const slice = content.slice(0, end);
    const match = slice.match(/(?:^|\s)@([\p{L}\p{N}_.-]*)$/u);
    return match ? match[1] : null;
  }, [content, caret]);

  const suggestions = useMemo(() => {
    if (activeQuery === null) return [];
    const q = activeQuery.toLowerCase();
    return mentionables
      .filter(
        (m) =>
          m.handle.toLowerCase().includes(q) ||
          m.label.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [activeQuery, mentionables]);

  function pickMention(m: Mentionable) {
    const end = Math.min(caret, content.length);
    const before = content.slice(0, end);
    const after = content.slice(end);
    const replaced = before.replace(
      /(?:^|\s)@([\p{L}\p{N}_.-]*)$/u,
      (full) => {
        const prefix = full.startsWith("@") ? "" : full[0];
        return `${prefix}@${m.handle} `;
      },
    );
    const next = replaced + after;
    setContent(next);
    setCaret(replaced.length);
    setMentionIds((prev) => new Set(prev).add(m.id));
    requestAnimationFrame(() => {
      const ta = ref.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(replaced.length, replaced.length);
    });
  }

  // Re-derive the mentions actually present in the final text so we don't send
  // stale ids for handles the user deleted before submitting.
  function activeMentionIds(): string[] {
    const ids: string[] = [];
    for (const m of mentionables) {
      if (!mentionIds.has(m.id)) continue;
      if (new RegExp(`(^|\\s)@${escapeRegex(m.handle)}(\\s|$)`, "u").test(content)) {
        ids.push(m.id);
      }
    }
    return ids;
  }

  return (
    <form
      action={(formData) => {
        formData.set("project_id", projectId);
        formData.set("task_id", taskId);
        formData.set("content", content);
        formData.delete("mentions");
        for (const id of activeMentionIds()) formData.append("mentions", id);
        startTransition(async () => {
          await addComment(formData);
          setContent("");
          setMentionIds(new Set());
        });
      }}
      className="flex flex-col gap-2"
    >
      <div className="relative">
        <Textarea
          ref={ref}
          placeholder={t("writeComment")}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={(e) => {
            const target = e.currentTarget;
            setCaret(target.selectionStart ?? target.value.length);
          }}
          required
          minLength={1}
          rows={3}
        />
        {suggestions.length > 0 ? (
          <div className="absolute z-10 mt-1 w-full max-w-xs overflow-hidden rounded-md border bg-popover shadow-md">
            {suggestions.map((m) => (
              <button
                key={m.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(m);
                }}
              >
                <span className="font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">
                  @{m.handle}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t("mention")}</p>
        <Button type="submit" disabled={pending || content.trim().length === 0} className="gap-2">
          <Send className="size-4" />
          {pending ? tc("saving") : t("send")}
        </Button>
      </div>
    </form>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
