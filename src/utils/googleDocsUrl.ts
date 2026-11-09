/**
 * Extracts Google Docs Document ID from a full Google Docs URL or a bare ID.
 * 
 * Supports:
 * - "https://docs.google.com/document/d/1cPki22T_7HXvo75pTAJ0Xn2G0eZS1avTcH--4UBfW7Q/edit" -> "1cPki22T_7HXvo75pTAJ0Xn2G0eZS1avTcH--4UBfW7Q"
 * - "https://docs.google.com/document/d/1cPki22T_7HXvo75pTAJ0Xn2G0eZS1avTcH--4UBfW7Q" -> "1cPki22T_7HXvo75pTAJ0Xn2G0eZS1avTcH--4UBfW7Q"
 * - "1cPki22T_7HXvo75pTAJ0Xn2G0eZS1avTcH--4UBfW7Q" -> "1cPki22T_7HXvo75pTAJ0Xn2G0eZS1avTcH--4UBfW7Q"
 */
export function extractDocId(urlOrId: string | undefined | null): string {
  if (!urlOrId) return '';
  const trimmed = String(urlOrId).trim();
  const match = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Normalizes full Google Docs URL from Document ID or URL.
 */
export function buildDocsUrl(docIdOrUrl: string): string {
  const docId = extractDocId(docIdOrUrl);
  return `https://docs.google.com/document/d/${docId}/edit`;
}
