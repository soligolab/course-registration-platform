import { groupLessons } from "@/lib/booking/validate";
import { formatShortDay, formatTime, lessonEnd } from "@/lib/format";

export function LessonList({ slots, locale }: { slots: string[]; locale: string }) {
  return (
    <ul className="space-y-0.5 text-sm">
      {groupLessons(slots).map((l) => (
        <li key={l.start} className="first-letter:uppercase">
          {formatShortDay(l.day, locale)} {formatTime(l.start, locale)}–{formatTime(lessonEnd(l.slots[l.slots.length - 1]), locale)}
        </li>
      ))}
    </ul>
  );
}
