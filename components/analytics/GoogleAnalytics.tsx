import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js). Renders nothing when NEXT_PUBLIC_GA_MEASUREMENT_ID isn't set,
 * so local dev and any environment without a Measurement ID stay clean (no GA hits from your
 * own testing). Set the env var in .env.local / Coolify to turn it on.
 */
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
