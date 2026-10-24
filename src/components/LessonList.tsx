import { groupLessons } from "@/lib/booking/validate";
import { formatShortDay, formatTime, lessonEnd } from "@/lib/format";

/** `size`: durata fissa delle lezioni in slot, per separare lezioni attaccate. */
export function LessonList({ slots, locale, size }: { slots: string[]; locale: string; size?: number }) {
  return (
    <ul className="space-y-0.5 text-sm">
      {groupLessons(slots, size).map((l) => (
        <li key={l.start} className="first-letter:uppercase">
          {formatShortDay(l.day, locale)} {formatTime(l.start, locale)}–{formatTime(lessonEnd(l.slots[l.slots.length - 1]), locale)}
        </li>
      ))}
    </ul>
  );
}
