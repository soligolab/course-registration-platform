import { HERO_HEIGHT_CLASS, type Theme } from "@/lib/theme";

/** Banner della home. Puramente presentazionale: lo usa anche l'anteprima in Admin → Aspetto. */
export function Hero({
  theme,
  title,
  subtitle,
  cta,
  ctaHref = "#pacchetti",
  bleed = theme.heroFullWidth,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
  cta: string;
  ctaHref?: string;
  /** a tutta larghezza: esce dal contenitore centrale fino ai bordi della finestra */
  bleed?: boolean;
}) {
  const center = theme.heroAlign === "center";
  return (
    <section
      className={`relative isolate flex items-center overflow-hidden ${HERO_HEIGHT_CLASS[theme.heroHeight]} ${
        bleed ? "left-1/2 -mt-8 w-screen -translate-x-1/2" : "rounded-[var(--radius)] shadow-[var(--shadow-card)]"
      }`}
      style={{ color: theme.heroText, backgroundColor: theme.heroImage ? theme.heroOverlay : theme.primary }}
    >
      {theme.heroImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.heroImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      )}
      {theme.heroImage && (
        <div className="absolute inset-0 -z-10" style={{ backgroundColor: theme.heroOverlay, opacity: theme.heroOverlayOpacity / 100 }} />
      )}
      <div className={`mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 ${center ? "text-center" : ""}`}>
        <div className={`max-w-2xl ${center ? "mx-auto" : ""}`}>
          <h1 className="text-3xl leading-tight sm:text-5xl" style={{ color: theme.heroText }}>
            {title}
          </h1>
          {subtitle && <p className="mt-4 text-base opacity-90 sm:text-lg">{subtitle}</p>}
          {theme.heroShowCta && cta && (
            <a href={ctaHref} className="btn-accent mt-7 px-6 py-3 text-base">
              {cta}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
