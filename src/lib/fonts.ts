import {
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  Inter,
  Lora,
  Manrope,
  Nunito,
  Outfit,
  Playfair_Display,
  Plus_Jakarta_Sans,
} from "next/font/google";

/*
 * next/font scarica i caratteri durante la build e li serve dal portale stesso: nessuna richiesta
 * a Google dal browser dei clienti (GDPR). Sono dichiarati tutti, ma il browser scarica solo quelli
 * che il tema usa davvero; preload disattivato per non caricarli tutti in anticipo.
 */
// next/font esige opzioni letterali (niente spread né variabili): ripetute per ogni carattere.
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-fraunces" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-playfair" });
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-lora" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", display: "swap", preload: false, variable: "--font-dmSerif" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-dmSans" });
const nunito = Nunito({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-nunito" });
const outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-outfit" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-jakarta" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-manrope" });
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-inter" });

/** Classi da mettere su <html>: definiscono le variabili --font-* usate da theme.ts. */
export const fontVariables = [fraunces, playfair, lora, dmSerif, dmSans, nunito, outfit, jakarta, manrope, inter]
  .map((f) => f.variable)
  .join(" ");
