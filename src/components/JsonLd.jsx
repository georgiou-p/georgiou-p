// Renders inline, not hoisted to <head> — JSON-LD doesn't need to live
// there per schema.org/Google's own guidance.
export default function JsonLd({ data }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
