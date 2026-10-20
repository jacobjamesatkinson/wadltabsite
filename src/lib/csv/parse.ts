/** Minimal RFC4180-ish CSV parse for pasted text (headers required). */

export type CsvTable = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function parseCsv(text: string): CsvTable {
  const lines = splitCsvLines(text);
  if (lines.length === 0) {
    throw new Error("CSV is empty");
  }

  const headerCells = parseCsvLine(lines[0]!);
  if (headerCells.length === 0 || headerCells.every((h) => !h.trim())) {
    throw new Error("CSV header row is missing");
  }

  const headers = headerCells.map((h) => h.trim());
  const keys = headers.map(normalizeHeader);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < keys.length; c++) {
      const key = keys[c]!;
      const value = (cells[c] ?? "").trim();
      if (value) any = true;
      row[key] = value;
      // Also keep original header key for readability in errors
      row[headers[c]!] = value;
    }
    if (any) rows.push(row);
  }

  return { headers, rows };
}

export function cell(row: Record<string, string>, ...aliases: string[]) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const value = row[key];
    if (value != null && value !== "") return value;
  }
  return "";
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length > 0 || text.endsWith("\n") || text.endsWith("\r")) {
    lines.push(current);
  }
  return lines;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export const IMPORT_SPECS = {
  institutions: {
    label: "Institutions",
    columns: "name, shortName",
    example: `name,shortName
Perth Senior High School,PERTH
Fremantle College,FREM`,
  },
  teams: {
    label: "Teams",
    columns:
      "institution (shortName, blank if independent), name (number if institution; same number ok across divisions), identifier (optional), division, venue (optional), timeslot (optional HH:MM)",
    example: `institution,name,division,venue,timeslot
PERTH,1,Junior A,UWA Arts Building,16:00
PERTH,1,Novice A,UWA Arts Building,16:00
FREM,1,Junior A,UWA Arts Building,16:00
,Independent Debaters,Senior A,,18:00`,
  },
  venues: {
    label: "Venues",
    columns: "name, address (optional), rosterDay (optional)",
    example: `name,address,rosterDay
UWA Arts Building,"35 Stirling Hwy, Crawley",Monday A
Curtin Building 200,Kent St Bentley,Tuesday B`,
  },
  rooms: {
    label: "Rooms",
    columns: "venue (required venue name), room",
    example: `venue,room
UWA Arts Building,R1
UWA Arts Building,R2
Curtin Building 200,Lab 1`,
  },
  adjudicators: {
    label: "Adjudicators",
    columns: "name, email, password (optional), qualifications (optional)",
    example: `name,email,password,qualifications
Jordan Adjudicator,jordan@example.com,Adj123456,Experienced
Sam Panel,sam@example.com,,`,
  },
} as const;

export type ImportKind = keyof typeof IMPORT_SPECS;
