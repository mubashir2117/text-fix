"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Image as ImageIcon, Package, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  contrastTextColor,
  ensureReadable,
  isDarkBackground,
  normalizeHexAlpha,
  type NormalizedRecreation,
} from "@/lib/formats";
import { cn } from "@/lib/utils";

/**
 * Renders a RecreateResult as real, editable HTML/CSS — never as a
 * flattened copy of the original image.
 *
 * Layers (spec §48):
 *   RecreatedPost
 *    ├── Background (+ optional decorative shapes)
 *    ├── Logo / icon row (honest brand chip — never fabricated artwork)
 *    ├── Image/graphic area (honest styled placeholder — the original
 *    │    photography cannot be fabricated)
 *    ├── Label → Headline → Subtitle → Body → Price
 *    ├── CTA
 *    └── Meta (website / handle / contact / hashtags)
 *
 * Everything derives from the normalized spec (lib/formats.ts) at the
 * canvas' native pixel size — the node is scaled down with a CSS
 * transform for previews, and exported 1:1 for downloads.
 */

const FONT_STACKS: Record<string, string> = {
  Inter: "var(--font-post-inter), Inter, system-ui, sans-serif",
  Manrope: "var(--font-post-manrope), Manrope, system-ui, sans-serif",
  Poppins: "var(--font-post-poppins), Poppins, system-ui, sans-serif",
  "DM Sans": "var(--font-post-dmsans), 'DM Sans', system-ui, sans-serif",
  "Plus Jakarta Sans": "var(--font-post-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif",
};

function stackFor(family: string): string {
  return FONT_STACKS[family] ?? FONT_STACKS.Inter;
}

function withAlpha(color: string, alphaHex: string): string {
  const base = normalizeHexAlpha(color);
  return base ? `${base}${alphaHex}` : color;
}

/** Gentle auto-shrink so long copy never overflows a fixed canvas. */
function textShrink(text: string): number {
  const length = text.trim().length;
  if (length > 140) return 0.64;
  if (length > 110) return 0.74;
  if (length > 80) return 0.84;
  if (length > 55) return 0.92;
  return 1;
}

export interface RecreatedPostProps {
  recreation: NormalizedRecreation;
  width: number;
  height: number;
  /**
   * Fixed display scale (1 = native size, used for exports). When
   * omitted the post fills its container responsively.
   */
  scale?: number;
  className?: string;
}

/** Colors for a text stack sitting on a given surface. */
interface StackPalette {
  headline: string;
  body: string;
  meta: string;
  accent: string;
}

export function RecreatedPost({ recreation, width, height, scale, className }: RecreatedPostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredScale, setMeasuredScale] = useState(1);

  useLayoutEffect(() => {
    if (scale !== undefined) return;
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const update = () => {
      const measured = element.clientWidth;
      if (measured > 0) setMeasuredScale(measured / width);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scale, width]);

  const effectiveScale = scale ?? measuredScale;

  const { design, typeStyles, layout, text, visualElements } = recreation;

  const unit = width / 1080;
  const aspect = height / width;
  const compact = Math.min(1, Math.sqrt(Math.min(1, aspect)));

  const base = typeStyles.baseSize * unit * compact;
  const padding = layout.padding * unit * (0.6 + 0.4 * compact);
  const gap = Math.max(6, layout.gap * unit * (0.7 + 0.3 * compact));

  const bodyFamily = stackFor(typeStyles.fontFamily);
  const headlineFamily = stackFor(typeStyles.headlineFontFamily || typeStyles.fontFamily);

  const align = design.alignment;
  const alignItems = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  const ctaBackground = design.buttonColor || design.accentColor;
  const ctaForeground = contrastTextColor(ctaBackground);

  const isDark = isDarkBackground(design.background);
  const cardBackground = isDark ? "rgba(255,255,255,0.08)" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.18)" : "rgba(17,24,28,0.08)";
  const cardPalette: StackPalette = isDark
    ? {
        headline: design.textColor,
        body: design.secondaryColor,
        meta: ensureReadable(design.secondaryColor, design.background),
        accent: design.accentColor,
      }
    : {
        headline: ensureReadable(design.textColor, "#FFFFFF"),
        body: ensureReadable(design.secondaryColor, "#FFFFFF"),
        meta: ensureReadable(design.secondaryColor, "#FFFFFF"),
        accent: ensureReadable(design.accentColor, "#FFFFFF"),
      };

  const photoElement = visualElements.find((element) =>
    ["product_image", "people", "photo"].includes(element.type)
  );
  const decorativeElements = visualElements.filter((element) =>
    ["shape", "decorative", "background_graphic", "line", "border"].includes(element.type)
  );
  // Logos and icons form the brand layer — rendered as a tasteful chip
  // row (monogram + brand wordmark), never as fabricated logo artwork.
  const brandElements = visualElements
    .filter((element) => element.type === "logo" || element.type === "icon")
    .slice(0, 3);
  const brandAtBottom = brandElements.some((element) =>
    element.placement.toLowerCase().includes("bottom")
  );
  const showDecorations = decorativeElements.length > 0 || layout.imagePlacement === "background";

  // --- text roles ---------------------------------------------------------

  interface BuildOptions {
    palette?: StackPalette;
  }

  const buildStack = ({ palette }: BuildOptions = {}) => {
    const colors: StackPalette = palette ?? {
      headline: design.textColor,
      body: design.secondaryColor,
      meta: design.secondaryColor,
      accent: design.accentColor,
    };

    const roleStyle = (
      role: "headline" | "subtitle" | "body",
      options: { family?: string; color?: string; scale?: number; sourceText: string }
    ): CSSProperties => {
      const spec = typeStyles[role];
      return {
        fontFamily: options.family ?? bodyFamily,
        fontWeight: spec.weight,
        fontSize: base * spec.scale * (options.scale ?? 1) * textShrink(options.sourceText),
        letterSpacing: `${spec.tracking}em`,
        lineHeight: spec.lineHeight,
        textTransform: spec.uppercase ? "uppercase" : "none",
        color: options.color ?? colors.headline,
        textAlign: align,
        overflowWrap: "break-word",
        margin: 0,
      };
    };

    const brand =
      brandElements.length > 0 ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: Math.round(12 * unit),
            maxWidth: "100%",
          }}
        >
          {brandElements.map((element, index) => {
            const wordmark =
              text.label.trim() || (element.type === "logo" ? element.description.trim() : "");
            const monogram = wordmark.replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase();
            return (
              <span
                key={`${element.type}-${index}`}
                title={element.description || element.type}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: Math.round(11 * unit),
                  maxWidth: "100%",
                }}
              >
                <span
                  style={{
                    width: Math.round(46 * unit),
                    height: Math.round(46 * unit),
                    borderRadius: element.type === "icon" ? 999 : Math.round(13 * unit),
                    background: withAlpha(design.accentColor, "1F"),
                    border: `1px solid ${withAlpha(design.accentColor, "3D")}`,
                    color: colors.accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontFamily: headlineFamily,
                    fontWeight: 800,
                    fontSize: base * 1.05,
                    lineHeight: 1,
                  }}
                >
                  {monogram ||
                    (element.type === "icon" ? (
                      <span
                        style={{
                          width: Math.round(14 * unit),
                          height: Math.round(14 * unit),
                          borderRadius: 999,
                          background: colors.accent,
                          display: "block",
                        }}
                      />
                    ) : null)}
                </span>
                {wordmark ? (
                  <span
                    style={{
                      fontFamily: headlineFamily,
                      fontWeight: 700,
                      fontSize: base * 0.86,
                      letterSpacing: "0.01em",
                      lineHeight: 1.2,
                      color: colors.headline,
                      overflowWrap: "break-word",
                    }}
                  >
                    {wordmark}
                  </span>
                ) : null}
              </span>
            );
          })}
        </span>
      ) : null;

    const label = text.label ? (
      <span
        style={{
          ...roleStyle("subtitle", {
            family: headlineFamily,
            color: colors.accent,
            scale: 0.62,
            sourceText: text.label,
          }),
          fontWeight: Math.max(700, typeStyles.subtitle.weight),
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {text.label}
      </span>
    ) : null;

    const headline = text.headline ? (
      <h1 style={roleStyle("headline", { family: headlineFamily, sourceText: text.headline })}>
        {text.headline}
      </h1>
    ) : null;

    const subtitle = text.subtitle ? (
      <p style={roleStyle("subtitle", { family: headlineFamily, sourceText: text.subtitle })}>
        {text.subtitle}
      </p>
    ) : null;

    const body = text.body ? (
      <p style={roleStyle("body", { color: colors.body, sourceText: text.body })}>{text.body}</p>
    ) : null;

    const price = text.price ? (
      <p
        style={{
          ...roleStyle("headline", {
            family: headlineFamily,
            color: colors.accent,
            sourceText: text.price,
          }),
          fontSize: base * Math.max(1.7, typeStyles.headline.scale * 0.7) * textShrink(text.price),
          fontWeight: Math.max(800, typeStyles.headline.weight),
        }}
      >
        {text.price}
      </p>
    ) : null;

    const divider = layout.showDivider ? (
      <span
        aria-hidden
        style={{
          display: "block",
          width: Math.max(48, 84 * unit),
          height: Math.max(3, 5 * unit),
          borderRadius: 999,
          background: colors.accent,
        }}
      />
    ) : null;

    const cta = text.cta ? (() => {
      const spec = typeStyles.cta;
      const fontSize = Math.min(Math.max(base * spec.scale, base * 0.95), base * 1.7);
      const shared: CSSProperties = {
        fontFamily: bodyFamily,
        fontWeight: spec.weight,
        fontSize,
        letterSpacing: `${spec.tracking}em`,
        lineHeight: spec.lineHeight,
        textTransform: spec.uppercase ? "uppercase" : "none",
        textAlign: "center",
        overflowWrap: "break-word",
        display: "inline-block",
        maxWidth: "100%",
      };

      if (layout.ctaStyle === "text_link") {
        return (
          <span
            style={{
              ...shared,
              color: colors.accent,
              textDecoration: "underline",
              textUnderlineOffset: Math.round(fontSize * 0.28),
              textDecorationThickness: Math.max(2, Math.round(fontSize * 0.07)),
            }}
          >
            {text.cta}
          </span>
        );
      }

      return (
        <span
          style={{
            ...shared,
            background: ctaBackground,
            color: ctaForeground,
            padding: `${Math.round(fontSize * 0.72)}px ${Math.round(fontSize * 1.5)}px`,
            borderRadius: layout.ctaStyle === "rectangle" ? Math.round(14 * unit) : 9999,
            boxShadow: `0 ${Math.round(10 * unit)}px ${Math.round(28 * unit)}px ${withAlpha(ctaBackground, "33")}`,
          }}
        >
          {text.cta}
        </span>
      );
    })() : null;

    const metaParts = [text.website, text.handle, text.contact, text.hashtags].filter(
      (part) => part.trim().length > 0
    );
    const meta = metaParts.length > 0 ? (
      <p
        style={{
          fontFamily: bodyFamily,
          fontWeight: 500,
          fontSize: base * 0.78,
          lineHeight: 1.45,
          color: colors.meta,
          textAlign: align,
          overflowWrap: "break-word",
          margin: 0,
        }}
      >
        {metaParts.join("  ·  ")}
      </p>
    ) : null;

    return { brand, label, headline, subtitle, body, price, divider, cta, meta };
  };

  const stack = buildStack();
  const cardStack = buildStack({ palette: cardPalette });

  const listOf = (parts: ReturnType<typeof buildStack>): ReactNode[] => {
    const content: ReactNode[] = [
      parts.label,
      parts.headline,
      parts.subtitle,
      parts.body,
      parts.price,
      parts.divider,
      parts.cta,
      parts.meta,
    ].filter((node) => node !== null && node !== undefined);

    const withBrand = brandAtBottom
      ? [...content, parts.brand]
      : [parts.brand, ...content];

    return withBrand.filter((node) => node !== null && node !== undefined);
  };

  const stackChildren = listOf(stack);

  /** Wraps children so text blocks align to the design's alignment grid. */
  const row = (node: ReactNode, key: number | string): ReactNode => (
    <div key={key} style={{ width: alignItems === "center" ? "auto" : "100%", maxWidth: "100%" }}>
      {node}
    </div>
  );

  // --- graphic area (styled placeholder for photo-like elements) ----------

  const graphicArea = (fillStyle: CSSProperties): ReactNode => {
    const primaryHex = normalizeHexAlpha(design.primaryColor);
    const accentHex = normalizeHexAlpha(design.accentColor);
    const gradient =
      primaryHex && accentHex
        ? `linear-gradient(135deg, ${primaryHex}1A, ${accentHex}2B)`
        : `linear-gradient(135deg, ${design.primaryColor}, ${design.accentColor})`;
    const Icon =
      photoElement?.type === "people" ? Users : photoElement?.type === "product_image" ? Package : ImageIcon;

    return (
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: Math.round(28 * unit),
          background: gradient,
          border: `1px solid ${primaryHex ? `${primaryHex}2E` : design.primaryColor}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(14 * unit),
          minHeight: Math.round(140 * unit),
          ...fillStyle,
        }}
      >
        <span
          aria-hidden
          style={{
            width: Math.round(78 * unit),
            height: Math.round(78 * unit),
            borderRadius: 999,
            background: primaryHex ? `${primaryHex}1F` : "rgba(127,127,127,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={Math.round(34 * unit)} style={{ color: design.primaryColor }} strokeWidth={1.75} />
        </span>
        {photoElement?.description ? (
          <span
            style={{
              fontFamily: bodyFamily,
              fontSize: base * 0.76,
              fontWeight: 500,
              color: design.secondaryColor,
              textAlign: "center",
              maxWidth: "80%",
              lineHeight: 1.4,
              overflowWrap: "break-word",
            }}
          >
            {photoElement.description}
          </span>
        ) : null}
      </div>
    );
  };

  const graphicBoxStyle: CSSProperties = {
    width: "100%",
    flex: "1 1 auto",
    minHeight: Math.round(150 * unit),
    maxHeight: "46%",
    display: "flex",
    boxSizing: "border-box",
  };

  const topGraphic =
    layout.imagePlacement === "top" || layout.imagePlacement === "side"
      ? graphicArea({ width: "100%", height: "100%" })
      : null;
  const bottomGraphic = layout.imagePlacement === "bottom" ? graphicArea({ width: "100%", height: "100%" }) : null;

  // --- templates -----------------------------------------------------------

  const renderCenteredStack = (): ReactNode => (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        boxSizing: "border-box",
        height: "100%",
        width: "100%",
        padding,
        display: "flex",
        flexDirection: "column",
        alignItems,
        justifyContent: "center",
        gap,
        overflow: "hidden",
      }}
    >
      {layout.imagePlacement !== "none" && layout.imagePlacement !== "bottom" && topGraphic && (
        <div style={graphicBoxStyle}>{topGraphic}</div>
      )}
      {stackChildren.map((node, index) => row(node, index))}
      {layout.imagePlacement === "bottom" && bottomGraphic && (
        <div style={graphicBoxStyle}>{bottomGraphic}</div>
      )}
    </div>
  );

  const renderTopBottom = (): ReactNode => {
    const graphicFirst = layout.imagePlacement !== "bottom";
    const graphicNode = graphicFirst ? topGraphic : bottomGraphic;
    return (
      <div
        style={{
          position: "relative",
          zIndex: 1,
          boxSizing: "border-box",
          height: "100%",
          width: "100%",
          padding,
          display: "flex",
          flexDirection: "column",
          gap,
          overflow: "hidden",
        }}
      >
        {graphicNode && <div style={{ ...graphicBoxStyle, maxHeight: "44%" }}>{graphicNode}</div>}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems,
            justifyContent: "center",
            gap,
            overflow: "hidden",
          }}
        >
          {stackChildren.map((node, index) => row(node, index))}
        </div>
      </div>
    );
  };

  const renderSplitPanel = (): ReactNode => {
    const isTall = aspect >= 1.2;
    return (
      <div
        style={{
          position: "relative",
          zIndex: 1,
          boxSizing: "border-box",
          height: "100%",
          width: "100%",
          padding,
          display: "flex",
          flexDirection: isTall ? "column" : "row",
          gap: isTall ? gap : Math.round(gap * 2),
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "1 1 54%",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems,
            justifyContent: "center",
            gap,
            overflow: "hidden",
          }}
        >
          {layout.imagePlacement === "top" && topGraphic && (
            <div style={{ ...graphicBoxStyle, maxHeight: "40%" }}>{topGraphic}</div>
          )}
          {stackChildren.map((node, index) => row(node, index))}
        </div>
        {topGraphic && (
          <div
            style={{
              flex: isTall ? "1 1 40%" : "1 1 46%",
              minWidth: 0,
              minHeight: isTall ? Math.round(200 * unit) : 0,
              maxHeight: isTall ? "42%" : "none",
              display: "flex",
            }}
          >
            {topGraphic}
          </div>
        )}
      </div>
    );
  };

  const renderTextCard = (): ReactNode => (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        boxSizing: "border-box",
        height: "100%",
        width: "100%",
        padding,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          maxHeight: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
          background: cardBackground,
          border: `1px solid ${cardBorder}`,
          borderRadius: Math.round(36 * unit),
          padding: padding * 0.8,
          display: "flex",
          flexDirection: "column",
          alignItems,
          justifyContent: "center",
          gap,
          boxShadow: `0 ${Math.round(28 * unit)}px ${Math.round(64 * unit)}px rgba(10, 12, 14, ${isDark ? 0.45 : 0.16})`,
        }}
      >
        {layout.imagePlacement !== "none" && layout.imagePlacement !== "bottom" && topGraphic && (
          <div style={{ ...graphicBoxStyle, maxHeight: "40%" }}>{topGraphic}</div>
        )}
        {listOf(cardStack).map((node, index) => row(node, index))}
        {layout.imagePlacement === "bottom" && bottomGraphic && (
          <div style={{ ...graphicBoxStyle, maxHeight: "40%" }}>{bottomGraphic}</div>
        )}
      </div>
    </div>
  );

  const renderMinimalGrid = (): ReactNode => (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        boxSizing: "border-box",
        height: "100%",
        width: "100%",
        padding,
        display: "flex",
        flexDirection: "column",
        gap,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems, gap: gap * 0.7 }}>
        {!brandAtBottom && stack.brand}
        <span
          aria-hidden
          style={{
            width: Math.round(84 * unit),
            height: Math.round(7 * unit),
            borderRadius: 999,
            background: design.accentColor,
          }}
        />
        {stack.label}
        {stack.headline}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems,
          gap: gap * 0.8,
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {layout.imagePlacement !== "none" && topGraphic && (
          <div style={{ ...graphicBoxStyle, maxHeight: "38%" }}>{topGraphic}</div>
        )}
        {stack.subtitle}
        {stack.body}
        {stack.price}
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems,
          gap: gap * 0.8,
        }}
      >
        {stack.divider}
        {stack.cta}
        {stack.meta}
        {brandAtBottom && stack.brand}
      </div>
    </div>
  );

  const templateContent =
    layout.template === "split_panel"
      ? renderSplitPanel()
      : layout.template === "top_bottom"
        ? renderTopBottom()
        : layout.template === "text_card"
          ? renderTextCard()
          : layout.template === "minimal_grid"
            ? renderMinimalGrid()
            : renderCenteredStack();

  // --- decorations ---------------------------------------------------------

  const decorations = showDecorations ? (
    <div
      aria-hidden
      style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}
    >
      <div
        style={{
          position: "absolute",
          top: -width * 0.18,
          right: -width * 0.16,
          width: width * 0.52,
          height: width * 0.52,
          borderRadius: "50%",
          background: withAlpha(design.accentColor, "14"),
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -width * 0.2,
          left: -width * 0.14,
          width: width * 0.46,
          height: width * 0.46,
          borderRadius: "50%",
          background: withAlpha(design.primaryColor, "12"),
        }}
      />
      {layout.imagePlacement === "background" && (
        <div
          style={{
            position: "absolute",
            inset: Math.round(padding),
            borderRadius: Math.round(32 * unit),
            border: `2px solid ${withAlpha(design.accentColor, "2B")}`,
          }}
        />
      )}
    </div>
  ) : null;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{
        width: scale !== undefined ? width * scale : "100%",
        aspectRatio: `${width} / ${height}`,
        background: design.background,
      }}
      data-recreated-post={recreation.title}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          boxSizing: "border-box",
          transformOrigin: "top left",
          transform: `scale(${effectiveScale})`,
          background: design.background,
          color: design.textColor,
          overflow: "hidden",
        }}
      >
        {decorations}
        {templateContent}
      </div>
    </div>
  );
}
