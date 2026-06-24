import Script from "next/script";

// Reddit advertising pixel. Renders only when NEXT_PUBLIC_REDDIT_PIXEL_ID is
// set, so local dev / preview without the env var is a no-op. Fires the base
// PageVisit on load; the SignUp conversion is fired from onboarding success
// (see src/lib/reddit.ts).
export default function RedditPixel() {
  const id = process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID;
  if (!id) return null;

  return (
    <Script id="reddit-pixel" strategy="afterInteractive">
      {`!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init','${id}');rdt('track','PageVisit');`}
    </Script>
  );
}
