import 'server-only';
import { sql } from './db';
import { CATEGORIES, TEST_CATEGORY_NAME, type SystemType } from './constants';

export type Dashboard = {
  stats: { mainParts: number; mainFiles: number; testParts: number; testFiles: number; newMainParts: number; newTestParts: number; systemKB: number };
  completeness: { total: number; full: number; mid: number; low: number };
  incompleteTotal: number;
  incomplete: { partCode: string; partName: string; filled: number; missing: { no: number; name: string }[] }[];
  recent: { system: SystemType; partCode: string; fileName: string; fileUrl: string; categoryNo: number; categoryName: string; uploader: string; uploadedAt: string }[];
};

export async function getDashboard(): Promise<Dashboard> {
  const r = await sql`select dashboard_summary() as d`;
  return r[0].d as Dashboard;
}

export type PartRow = { partCode: string; partName: string; cats: number[]; lastAt: string; files: number };

export async function getPartsList(system: SystemType): Promise<PartRow[]> {
  const rows = await sql`select * from parts_summary(${system})`;
  return rows.map((r) => ({
    partCode: r.part_code,
    partName: r.part_name || '',
    cats: (r.cats as number[]) || [],
    lastAt: new Date(r.last_at).toISOString(),
    files: Number(r.files)
  }));
}

export type DocFile = { id: number; fileName: string; fileUrl: string; uploadedAt: string; uploader: string; sizeKb: number };
export type PartDetail = {
  system: SystemType;
  partCode: string;
  partName: string;
  categories: { no: number; name: string; files: DocFile[] }[];
};

export async function getPartDetail(system: SystemType, code: string): Promise<PartDetail | null> {
  const rows = await sql`
    select id, part_code, part_name, category_no, file_name, file_url, uploaded_at, uploader, size_kb
    from documents
    where system = ${system} and status = 'active' and lower(part_code) = lower(${code})
    order by uploaded_at desc`;
  if (rows.length === 0) return null;
  const toFile = (r: (typeof rows)[number]): DocFile => ({
    id: Number(r.id), fileName: r.file_name, fileUrl: r.file_url,
    uploadedAt: new Date(r.uploaded_at).toISOString(), uploader: r.uploader, sizeKb: Number(r.size_kb)
  });
  const cats = system === 'test'
    ? [{ no: 1, name: TEST_CATEGORY_NAME, files: rows.map(toFile) }]
    : CATEGORIES.map((c) => ({ ...c, files: rows.filter((r) => Number(r.category_no) === c.no).map(toFile) }));
  return { system, partCode: rows[0].part_code, partName: rows[0].part_name || '', categories: cats };
}
