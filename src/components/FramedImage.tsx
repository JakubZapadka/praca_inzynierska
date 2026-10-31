import type { CSSProperties, ReactNode } from "react";

export type FrameKind = "framed" | "poster" | "canvas";

interface Props {
  src?: string | null;
  alt?: string;
  /** Proporcje w formacie CSS, np. "3 / 4". */
  aspect: string;
  kind?: FrameKind;
  frameColor?: string;
  state?: "empty" | "pending" | "done" | "failed";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Obraz "powieszony" na ścianie: rama, passe-partout i cień. */
export function FramedImage({
  src,
  alt = "",
  aspect,
  kind = "framed",
  frameColor = "#22201d",
  state = src ? "done" : "empty",
  className = "",
  style,
  children,
}: Props) {
  return (
    <div
      className={`frame ${className}`}
      data-kind={kind}
      style={{ "--frame-color": frameColor, ...style } as CSSProperties}
    >
      <div className="relative overflow-hidden bg-wall-deep/40" style={{ aspectRatio: aspect }}>
        {state === "done" && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={alt} className="frame-img develop" />
        ) : null}
        {state === "pending" ? <div className="breathe absolute inset-0 bg-wall-deep" aria-hidden /> : null}
        {children}
      </div>
    </div>
  );
}
