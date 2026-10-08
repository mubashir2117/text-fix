import type {
  DesignSummary,
  FontStyleSpec,
  ImagePlacement,
  ImprovementItem,
  PostFormatId,
  RecreateResult,
  RecreateTemplate,
  CtaStyle,
  TextAlignment,
  TextElementAssessment,
  VisualElement,
} from "./validation";

/**
 * Shared (client + server) post-format definitions and the
 * normalization layer that turns a validated-but-sparse Gemini
 * recreation response into a fully-specified, renderable design spec.
 *
 * The renderer (components/recreated-post.tsx) only ever consumes
 * NormalizedRecreation — never the raw model response — so every
 * default, color fix, and contrast adjustment happens in one place.
 */

// --- Post formats ---------------------------------------------------------

export interface PostFormat {
  id: PostFormatId;
  label: string;
  width: number;
  height: number;
}

export const POST_FORMATS: PostFormat[] = [
  { id: "instagram_portrait", label: "Instagram Portrait", width: 1080, height: 1350 },
  { id: "instagram_square", label: "Instagram Square", width: 1080, height: 1080 },
  { id: "instagram_story", label: "Instagram Story", width: 1080, height: 1920 },
  { id: "reel_cover", label: "Reel Cover", width: 1080, height: 1920 },
  { id: "linkedin", label: "LinkedIn", width: 1200, height: 1200 },
  { id: "facebook", label: "Facebook", width: 1200, height: 630 },
  { id: "custom", label: "Custom", width: 1080, height: 1080 },
];

export const MIN_CUSTOM_DIMENSION = 320;
export const MAX_CUSTOM_DIMENSION = 4096;

export function getPostFormat(id: PostFormatId): PostFormat {
  return POST_FORMATS.find((format) => format.id === id) ?? POST_FORMATS[0];
}

export function clampCustomDimension(value: number): number {
  if (Number.isNaN(value)) return 1080;
  return Math.min(MAX_CUSTOM_DIMENSION, Math.max(MIN_CUSTOM_DIMENSION, Math.round(value)));
}

// --- Color helpers --------------------------------------------------------

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_CSS_COLOR_REGEX = /^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%deg/]+\))$/;
const SAFE_GRADIENT_REGEX = /^(?:linear|radial|conic)-gradient\([\d.,\s#a-zA-Z()%/-]+\)$/;
const NAMED_COLOR_REGEX = /^[a-z]{3,20}$/;

/**
 * Sanitizes anything the model produced into a CSS value we are
 * willing to put in inline `style` — a hex/rgb/hsl color or a
 * gradient. Anything else falls back to the provided default so a
 * malformed string can never inject CSS or break the render.
 */
export function sanitizeColor(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  if (!v) return fallback;
  if (HEX_COLOR_REGEX.test(v) || SAFE_CSS_COLOR_REGEX.test(v)) return v;
  if (SAFE_GRADIENT_REGEX.test(v)) return v;
  if (NAMED_COLOR_REGEX.test(v)) return v;
  return fallback;
}

/** True when the value is a single flat color (not a gradient). */
export function isFlatColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value) || SAFE_CSS_COLOR_REGEX.test(value) || NAMED_COLOR_REGEX.test(value);
}

function hexToRgb(hex: string): [number, number, number] | null {
  let value = hex.replace("#", "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (value.length === 8) value = value.slice(0, 6);
  if (value.length !== 6 || /[^0-9a-fA-F]/.test(value)) return null;
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** Expands #abc -> #aabbcc so we can safely append alpha suffixes. */
export function normalizeHexAlpha(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a flat color, or null if unparseable. */
export function relativeLuminance(color: string): number | null {
  if (!isFlatColor(color)) return null;
  const rgb = HEX_COLOR_REGEX.test(color) ? hexToRgb(color) : parseRgbColor(color);
  if (!rgb) return null;
  return (
    0.2126 * channelLuminance(rgb[0]) + 0.7152 * channelLuminance(rgb[1]) + 0.0722 * channelLuminance(rgb[2])
  );
}

function parseRgbColor(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => parseFloat(part.trim()));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return [Math.round(parts[0]), Math.round(parts[1]), Math.round(parts[2])];
}

/**
 * Picks a readable foreground for a background: near-white on dark
 * backgrounds, near-black on light ones. Used for CTA labels and to
 * rescue low-contrast body text.
 */
export function contrastTextColor(background: string): string {
  const luminance = relativeLuminance(background);
  if (luminance === null) return "#FFFFFF";
  return luminance > 0.42 ? "#14171A" : "#FFFFFF";
}

/** True when a background is dark (used to pick card/overlay treatments). */
export function isDarkBackground(background: string): boolean {
  const luminance = relativeLuminance(background);
  if (luminance === null) return false;
  return luminance <= 0.42;
}

/**
 * Returns a readable text color for the given background. Keeps the
 * requested color when it already has enough contrast; otherwise
 * returns white/near-black so the design never ships unreadable text.
 */
export function ensureReadable(textColor: string, background: string): string {
  const bgLuminance = relativeLuminance(background);
  const fgLuminance = relativeLuminance(textColor);
  if (bgLuminance === null || fgLuminance === null) return textColor;

  const contrast =
    (Math.max(bgLuminance, fgLuminance) + 0.05) / (Math.min(bgLuminance, fgLuminance) + 0.05);
  return contrast >= 4.5 ? textColor : contrastTextColor(background);
}

/**
 * Extracts the first flat color found in a (possibly gradient)
 * background so contrast checks have something to measure.
 */
export function dominantBackgroundColor(background: string): string {
  if (isFlatColor(background)) return background;
  const hexMatch = background.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hexMatch) return hexMatch[0];
  const rgbMatch = background.match(/rgba?\([^)]+\)/);
  if (rgbMatch) return rgbMatch[0];
  return "#FFFFFF";
}

// --- Defaults -------------------------------------------------------------

export const DEFAULT_FONT_FAMILY = "Inter";

interface ResolvedFontStyle {
  weight: number;
  scale: number;
  tracking: number;
  lineHeight: number;
  uppercase: boolean;
}

const DEFAULT_FONT_STYLES: Record<"headline" | "subtitle" | "body" | "cta", ResolvedFontStyle> = {
  headline: { weight: 800, scale: 2.7, tracking: -0.02, lineHeight: 1.06, uppercase: false },
  subtitle: { weight: 600, scale: 1.3, tracking: 0, lineHeight: 1.35, uppercase: false },
  body: { weight: 400, scale: 1, tracking: 0, lineHeight: 1.5, uppercase: false },
  cta: { weight: 700, scale: 1.05, tracking: 0.02, lineHeight: 1.2, uppercase: false },
};

const DEFAULT_LAYOUT = {
  template: "centered_stack" as RecreateTemplate,
  padding: 72,
  gap: 28,
  imagePlacement: "none" as ImagePlacement,
  ctaStyle: "pill" as CtaStyle,
  showDivider: false,
};

const DEFAULT_COLORS = {
  background: "#FFFFFF",
  primaryColor: "#1F2430",
  secondaryColor: "#5B6270",
  textColor: "#1F2430",
  accentColor: "#B23A28",
  buttonColor: "",
};

// --- Normalization ---------------------------------------------------------

export type ResolvedAlignment = TextAlignment;

export interface NormalizedFontStyle {
  weight: number;
  scale: number;
  tracking: number;
  lineHeight: number;
  uppercase: boolean;
}

export interface NormalizedRecreation {
  title: string;
  format: PostFormatId;
  text: {
    headline: string;
    subtitle: string;
    body: string;
    cta: string;
    label: string;
    price: string;
    contact: string;
    website: string;
    handle: string;
    hashtags: string;
  };
  design: {
    background: string;
    primaryColor: string;
    secondaryColor: string;
    textColor: string;
    accentColor: string;
    buttonColor: string;
    alignment: TextAlignment;
    visualHierarchy: string;
  };
  typography: { headline: string; subtitle: string; body: string; cta: string };
  typeStyles: {
    fontFamily: string;
    headlineFontFamily: string;
    baseSize: number;
    headline: NormalizedFontStyle;
    subtitle: NormalizedFontStyle;
    body: NormalizedFontStyle;
    cta: NormalizedFontStyle;
  };
  layout: {
    template: RecreateTemplate;
    padding: number;
    gap: number;
    imagePlacement: ImagePlacement;
    ctaStyle: CtaStyle;
    showDivider: boolean;
  };
  visualElements: VisualElement[];
  improvements: string[];
  /** Per-element original vs. recommended text assessment (§12). */
  textAnalysis: TextElementAssessment[];
  /** "What improved?" report, including what was left unchanged (§10-§11). */
  improvementReport: ImprovementItem[];
  /** AI-generated design improvement summary (§13). */
  summary: DesignSummary | null;
  notes: string;
  hasImageArea: boolean;
}

function resolveFontStyle(spec: FontStyleSpec | undefined, key: keyof typeof DEFAULT_FONT_STYLES): NormalizedFontStyle {
  const fallback = DEFAULT_FONT_STYLES[key];
  if (!spec) return { ...fallback };
  return {
    weight: spec.weight ?? fallback.weight,
    scale: spec.scale ?? fallback.scale,
    tracking: spec.tracking ?? fallback.tracking,
    lineHeight: spec.lineHeight ?? fallback.lineHeight,
    uppercase: spec.uppercase ?? fallback.uppercase,
  };
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Turns a validated Gemini recreation into a fully-specified design
 * spec: every default filled in, every color sanitized, contrast
 * guaranteed, and the requested format stamped on.
 */
export function normalizeRecreation(result: RecreateResult, requestedFormat: PostFormatId): NormalizedRecreation {
  const design = result.design;
  const layout = result.layout;

  const background = sanitizeColor(design?.background, DEFAULT_COLORS.background);
  const flatBackground = dominantBackgroundColor(background);

  const rawTextColor = sanitizeColor(design?.textColor, DEFAULT_COLORS.textColor);
  const textColor = ensureReadable(rawTextColor, flatBackground);

  const primaryColor = sanitizeColor(design?.primaryColor, DEFAULT_COLORS.primaryColor);
  const secondaryRaw = sanitizeColor(design?.secondaryColor, DEFAULT_COLORS.secondaryColor);
  const accentColor = sanitizeColor(design?.accentColor, DEFAULT_COLORS.accentColor);
  const buttonColor = sanitizeColor(design?.buttonColor, "");

  const visualElements = (result.visualElements ?? []).slice(0, 16);
  const photoElements = visualElements.filter((element) =>
    ["product_image", "people", "photo"].includes(element.type)
  );

  // The model picks an image placement; if it reported photo-like
  // visual elements but left placement as "none", give the render an
  // honest graphic area rather than silently dropping them.
  let imagePlacement: ImagePlacement = layout?.imagePlacement ?? "none";
  if (imagePlacement === "none" && photoElements.length > 0) {
    imagePlacement = "top";
  }
  const hasImageArea = imagePlacement !== "none";

  return {
    title: result.title || "Professional Post Recreation",
    format: result.format ?? requestedFormat,
    text: {
      headline: result.extractedText?.headline ?? "",
      subtitle: result.extractedText?.subtitle ?? "",
      body: result.extractedText?.body ?? "",
      cta: result.extractedText?.cta ?? "",
      label: result.extractedText?.label ?? "",
      price: result.extractedText?.price ?? "",
      contact: result.extractedText?.contact ?? "",
      website: result.extractedText?.website ?? "",
      handle: result.extractedText?.handle ?? "",
      hashtags: result.extractedText?.hashtags ?? "",
    },
    design: {
      background,
      primaryColor,
      secondaryColor: ensureReadable(secondaryRaw, flatBackground),
      textColor,
      accentColor,
      buttonColor,
      alignment: design?.alignment ?? "center",
      visualHierarchy: design?.visualHierarchy ?? "",
    },
    typography: {
      headline: result.typography?.headline ?? "",
      subtitle: result.typography?.subtitle ?? "",
      body: result.typography?.body ?? "",
      cta: result.typography?.cta ?? "",
    },
    typeStyles: {
      fontFamily: result.typeStyles?.fontFamily ?? DEFAULT_FONT_FAMILY,
      headlineFontFamily: result.typeStyles?.headlineFontFamily ?? result.typeStyles?.fontFamily ?? DEFAULT_FONT_FAMILY,
      baseSize: clampNumber(result.typeStyles?.baseSize, 14, 64, 30),
      headline: resolveFontStyle(result.typeStyles?.headline, "headline"),
      subtitle: resolveFontStyle(result.typeStyles?.subtitle, "subtitle"),
      body: resolveFontStyle(result.typeStyles?.body, "body"),
      cta: resolveFontStyle(result.typeStyles?.cta, "cta"),
    },
    layout: {
      template: layout?.template ?? DEFAULT_LAYOUT.template,
      padding: clampNumber(layout?.padding, 32, 200, DEFAULT_LAYOUT.padding),
      gap: clampNumber(layout?.gap, 8, 120, DEFAULT_LAYOUT.gap),
      imagePlacement,
      ctaStyle: layout?.ctaStyle ?? DEFAULT_LAYOUT.ctaStyle,
      showDivider: layout?.showDivider ?? DEFAULT_LAYOUT.showDivider,
    },
    visualElements,
    improvements: result.improvements ?? [],
    textAnalysis: result.textAnalysis ?? [],
    improvementReport: result.improvementReport ?? [],
    summary: result.summary ?? null,
    notes: result.notes ?? "",
    hasImageArea,
  };
}
