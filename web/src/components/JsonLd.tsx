/** Données structurées schema.org (bloc de données : non exécuté, donc compatible avec la CSP sans script en ligne). */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
