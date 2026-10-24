/** Immagini d'esempio incluse nel portale (public/presets). Si possono usare così o sostituire. */
export const PRESET_IMAGES = {
  banner: [
    { url: "/presets/banner-terracotta.svg", label: "Terracotta" },
    { url: "/presets/banner-miele.svg", label: "Miele" },
    { url: "/presets/banner-salvia.svg", label: "Salvia" },
    { url: "/presets/banner-tramonto.svg", label: "Tramonto" },
  ],
  logo: [
    { url: "/presets/logo-portale.svg", label: "Portale" },
    { url: "/presets/corso-sole.svg", label: "Sole" },
    { url: "/presets/corso-foglia.svg", label: "Foglia" },
    { url: "/presets/corso-onda.svg", label: "Onda" },
    { url: "/presets/corso-stella.svg", label: "Stella" },
    { url: "/presets/corso-cuore.svg", label: "Cuore" },
    { url: "/presets/corso-libro.svg", label: "Libro" },
    { url: "/presets/corso-nota.svg", label: "Nota" },
    { url: "/presets/corso-montagna.svg", label: "Montagna" },
  ],
  // immagini dentro le descrizioni dei pacchetti: solo quelle caricate
  content: [],
} as const;

export type MediaKind = keyof typeof PRESET_IMAGES;
