import { NovelWork, WorkType } from '../types/novel';
import { parseTagsFromCell } from './tagParser';
import { extractDocId } from './googleDocsUrl';

/**
 * Parses raw 2D row array from Google Sheets API, supporting header on Row 1 OR Row 2.
 */
export function parseSheetRowsToNovels(rows: any[][]): Partial<NovelWork>[] {
  if (!rows || rows.length < 2) return [];

  // 1. Identify which row is the header row (look in row 0 and row 1)
  let headerIndex = -1;
  const headerCandidates = [0, 1];

  for (const idx of headerCandidates) {
    if (!rows[idx]) continue;
    const rowStr = rows[idx].map((c) => String(c).toLowerCase().trim());
    const hasKey = rowStr.some((c) =>
      ['作品id', 'id', 'タイトル', 'title', '種別', 'type', 'url', '文書id', 'doc_id', 'タグ', 'tags'].some((k) =>
        c.includes(k)
      )
    );
    if (hasKey) {
      headerIndex = idx;
      break;
    }
  }

  // Fallback to row 1 (0-indexed: row 0 or 1)
  if (headerIndex === -1) {
    headerIndex = rows.length > 2 ? 1 : 0;
  }

  const headerRow = rows[headerIndex].map((c) => String(c).toLowerCase().trim());

  // Find column indices
  const getCol = (...names: string[]): number => {
    return headerRow.findIndex((h) => names.some((n) => h.includes(n.toLowerCase())));
  };

  const idCol = getCol('作品id', 'id');
  const titleCol = getCol('タイトル', 'title', '제목');
  const typeCol = getCol('種別', 'type', '유형');
  const urlOrDocIdCol = getCol('url', '文書id', 'doc_id', 'docurl', '문서id');
  const summaryCol = getCol('概要', 'summary', 'あらすじ', '한줄소개');
  const tagsCol = getCol('タグ', 'tags', '태그');
  const publishCol = getCol('公開', 'is_published', '공개여부');
  const dateCol = getCol('更新日', 'updated_at', '日付', '수정일');
  const authorCol = getCol('著者', 'author', '작가');

  const novels: Partial<NovelWork>[] = [];

  // Parse data rows starting after headerIndex
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const title = titleCol >= 0 && row[titleCol] ? String(row[titleCol]).trim() : '';
    if (!title) continue; // Skip empty rows

    const isPublishedRaw = publishCol >= 0 && row[publishCol] ? String(row[publishCol]).trim().toUpperCase() : 'Y';
    // If explicitly marked as N or FALSE or 비공개, can be filtered or flagged
    const isPublished = isPublishedRaw !== 'N' && isPublishedRaw !== 'FALSE' && isPublishedRaw !== '비공개';
    if (!isPublished) continue;

    const rawType = typeCol >= 0 && row[typeCol] ? String(row[typeCol]).trim() : '';
    const type: WorkType = rawType.includes('短編') || rawType.toLowerCase().includes('short') || rawType.includes('단편')
      ? 'short'
      : 'series';

    const rawUrlOrId = urlOrDocIdCol >= 0 && row[urlOrDocIdCol] ? String(row[urlOrDocIdCol]).trim() : '';
    const docId = extractDocId(rawUrlOrId) || `doc_${r}`;

    const summary = summaryCol >= 0 && row[summaryCol] ? String(row[summaryCol]).trim() : '';
    const rawTags = tagsCol >= 0 && row[tagsCol] ? String(row[tagsCol]).trim() : '';
    const tags = parseTagsFromCell(rawTags);

    const date = dateCol >= 0 && row[dateCol] ? String(row[dateCol]).trim() : new Date().toISOString().split('T')[0];
    const author = authorCol >= 0 && row[authorCol] ? String(row[authorCol]).trim() : '書斎の主';

    novels.push({
      id: docId,
      title,
      type,
      summary,
      author,
      tags,
      updatedAt: date,
      createdAt: date,
      docUrl: rawUrlOrId.startsWith('http') ? rawUrlOrId : undefined,
    });
  }

  return novels;
}
