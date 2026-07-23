/** Replaces the default Payload hexagon in the nav header with the Tigers' Den crest. */
export default function BrandIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/tigers-den-logo-nav.png"
      alt="Tigers' Den"
      width={32}
      height={32}
      style={{
        display: "block",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        objectFit: "cover",
      }}
    />
  );
}
