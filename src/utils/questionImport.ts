import type { DifficultyLevel, Question, QuestionSource, QuestionType } from '../types/study';

export interface ParsedQuestionDraft {
  tempId: string;
  selected: boolean;
  statement: string;
  options: string[];
  correctAnswer: string;
  solution: string;
  explanation: string;
  difficulty: DifficultyLevel;
  questionType: QuestionType;
  year?: string;
}

function makeTempId(index: number): string {
  return `imp-${Date.now().toString(36)}-${index}`;
}

function normalizeDifficulty(val: unknown): DifficultyLevel {
  const s = String(val ?? '').trim().toLowerCase();
  if (s === 'easy') return 'Easy';
  if (s === 'hard') return 'Hard';
  return 'Medium';
}

function normalizeType(val: unknown, hasOptions: boolean): QuestionType {
  const s = String(val ?? '').trim().toLowerCase();
  if (s === 'numerical') return 'Numerical';
  if (s === 'conceptual') return 'Conceptual';
  if (s === 'descriptive') return 'Descriptive';
  if (s === 'mcq') return 'MCQ';
  return hasOptions ? 'MCQ' : 'Conceptual';
}

function resolveOptionAnswer(rawAnswer: string, options: string[]): string {
  const trimmed = rawAnswer.trim();
  if (!trimmed || options.length === 0) return trimmed;

  // Match exact option text (case-insensitive)
  const exact = options.find((opt) => opt.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  // Match letter A/B/C/D or Option A or (A) or 1/2/3/4
  const letterMatch = trimmed.match(/^(?:option\s*)?\(?([a-d])\)?[.):]?$/i);
  if (letterMatch) {
    const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (options[idx]) return options[idx];
  }
  const numMatch = trimmed.match(/^([1-4])$/);
  if (numMatch) {
    const idx = Number(numMatch[1]) - 1;
    if (options[idx]) return options[idx];
  }
  return trimmed;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if (ch === '\n' && !inQuotes) {
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }
  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }
  return rows;
}

export function parseQuestionsFromJson(raw: string): ParsedQuestionDraft[] {
  const parsed = JSON.parse(raw) as unknown;
  const rawArr: unknown[] = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { questions?: unknown[] }).questions)
      ? ((parsed as { questions: unknown[] }).questions)
      : [];

  return rawArr
    .map((entry: unknown, idx: number): ParsedQuestionDraft | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const item = entry as Record<string, unknown>;
      const statement = String(item.statement ?? item.question ?? item.prompt ?? '').trim();
      if (!statement) return null;

      let options: string[] = [];
      if (Array.isArray(item.options)) {
        options = item.options.map((o) => String(o).trim()).filter(Boolean);
      } else if (typeof item.options === 'string') {
        options = item.options.split('|').map((o) => o.trim()).filter(Boolean);
      } else {
        options = ['optionA', 'optionB', 'optionC', 'optionD', 'a', 'b', 'c', 'd']
          .map((k) => (typeof item[k] === 'string' ? String(item[k]).trim() : ''))
          .filter(Boolean);
      }

      const rawCorrect = String(item.correctAnswer ?? item.answer ?? item.correct ?? '').trim();
      const correctAnswer = resolveOptionAnswer(rawCorrect, options) || options[0] || '';
      const solution = String(item.solution ?? item.explanation ?? '').trim();
      const explanation = String(item.explanation ?? item.solution ?? '').trim();

      return {
        tempId: makeTempId(idx),
        selected: true,
        statement,
        options,
        correctAnswer,
        solution: solution || (correctAnswer ? `Correct answer: ${correctAnswer}` : ''),
        explanation: explanation || solution || 'Imported by learner.',
        difficulty: normalizeDifficulty(item.difficulty),
        questionType: normalizeType(item.questionType ?? item.type, options.length > 0),
        year: item.year ? String(item.year).trim() : undefined,
      };
    })
    .filter((d: ParsedQuestionDraft | null): d is ParsedQuestionDraft => Boolean(d));
}

export function parseQuestionsFromCsv(raw: string): ParsedQuestionDraft[] {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (candidates: string[]) =>
    header.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const stmtIdx = findCol(['statement', 'question', 'prompt']);
  if (stmtIdx === -1) return [];

  const optsIdx = findCol(['options', 'choices']);
  const optAIdx = findCol(['optiona', 'choicea', 'opta']);
  const optBIdx = findCol(['optionb', 'choiceb', 'optb']);
  const optCIdx = findCol(['optionc', 'choicec', 'optc']);
  const optDIdx = findCol(['optiond', 'choiced', 'optd']);
  const ansIdx = findCol(['correctanswer', 'answer', 'correct']);
  const solIdx = findCol(['solution', 'explanation', 'rationale']);
  const diffIdx = findCol(['difficulty']);
  const typeIdx = findCol(['questiontype', 'type']);
  const yearIdx = findCol(['year']);

  return rows
    .slice(1)
    .map((cells, idx): ParsedQuestionDraft | null => {
      const statement = (cells[stmtIdx] ?? '').trim();
      if (!statement) return null;

      let options: string[] = [];
      if (optsIdx !== -1 && cells[optsIdx]) {
        options = cells[optsIdx]
          .split(/\s*\|\s*|\s*;;\s*/)
          .map((o) => o.trim())
          .filter(Boolean);
      } else {
        options = [optAIdx, optBIdx, optCIdx, optDIdx]
          .filter((i) => i !== -1)
          .map((i) => (cells[i] ?? '').trim())
          .filter(Boolean);
      }

      const rawAns = ansIdx !== -1 ? (cells[ansIdx] ?? '').trim() : '';
      const correctAnswer = resolveOptionAnswer(rawAns, options) || options[0] || '';
      const sol = solIdx !== -1 ? (cells[solIdx] ?? '').trim() : '';

      return {
        tempId: makeTempId(idx),
        selected: true,
        statement,
        options,
        correctAnswer,
        solution: sol || (correctAnswer ? `Correct answer: ${correctAnswer}` : ''),
        explanation: sol || 'Imported from CSV question sheet.',
        difficulty: normalizeDifficulty(diffIdx !== -1 ? cells[diffIdx] : ''),
        questionType: normalizeType(typeIdx !== -1 ? cells[typeIdx] : '', options.length > 0),
        year: yearIdx !== -1 && cells[yearIdx]?.trim() ? cells[yearIdx].trim() : undefined,
      };
    })
    .filter((d): d is ParsedQuestionDraft => Boolean(d));
}

export function parseQuestionsFromText(raw: string): ParsedQuestionDraft[] {
  const clean = raw.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  // Split into question blocks on numbered lines ("1.", "1)", "Q1.", "Q1:", "Q:")
  const lines = clean.split('\n');
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  const startPattern = /^(?:(?:Q|Question)\s*\d*[\s).:-]+|\d{1,3}[).]\s+)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock.length > 0 && currentBlock[currentBlock.length - 1] !== '') {
        currentBlock.push('');
      }
      continue;
    }
    if (startPattern.test(trimmed) && currentBlock.some((l) => l.length > 0)) {
      blocks.push(currentBlock);
      currentBlock = [trimmed];
    } else {
      currentBlock.push(trimmed);
    }
  }
  if (currentBlock.some((l) => l.length > 0)) {
    blocks.push(currentBlock);
  }

  // Fallback: split on blank lines if no explicit numbered markers grouped multiple items
  const finalBlocks =
    blocks.length <= 1 && clean.includes('\n\n')
      ? clean
          .split(/\n{2,}/)
          .map((chunk) => chunk.split('\n').map((l) => l.trim()).filter(Boolean))
          .filter((b) => b.length > 0)
      : blocks;

  const results: ParsedQuestionDraft[] = [];

  finalBlocks.forEach((blockLines, idx) => {
    const nonEmpty = blockLines.filter(Boolean);
    if (nonEmpty.length === 0) return;

    const optionRegex = /^(?:[A-Da-d][).:]|\([A-Da-d]\))\s*(.+)$/;
    const answerRegex = /^(?:Correct\s+Answer|Answer|Ans|Key)\s*[:\-]\s*(.+)$/i;
    const explanationRegex = /^(?:Explanation|Solution|Rationale|Note)\s*[:\-]\s*(.+)$/i;
    const difficultyRegex = /^(?:Difficulty|Level)\s*[:\-]\s*(.+)$/i;
    const yearRegex = /^(?:Year|Exam\s*Year)\s*[:\-]\s*(\d{4})$/i;

    const statementParts: string[] = [];
    const options: string[] = [];
    let rawAnswer = '';
    let explanation = '';
    let difficulty: DifficultyLevel = 'Medium';
    let year: string | undefined;

    for (const line of nonEmpty) {
      const ansMatch = line.match(answerRegex);
      if (ansMatch) {
        rawAnswer = ansMatch[1].trim();
        continue;
      }
      const expMatch = line.match(explanationRegex);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }
      const diffMatch = line.match(difficultyRegex);
      if (diffMatch) {
        difficulty = normalizeDifficulty(diffMatch[1]);
        continue;
      }
      const yrMatch = line.match(yearRegex);
      if (yrMatch) {
        year = yrMatch[1];
        continue;
      }
      const optMatch = line.match(optionRegex);
      if (optMatch) {
        options.push(optMatch[1].trim());
        continue;
      }

      // Simple Q: ... / A: ... pair
      if (statementParts.length === 0) {
        statementParts.push(line.replace(startPattern, '').trim());
      } else if (options.length === 0 && !rawAnswer) {
        if (/^A\s*[:\-]\s*/i.test(line)) {
          rawAnswer = line.replace(/^A\s*[:\-]\s*/i, '').trim();
        } else {
          statementParts.push(line);
        }
      } else if (explanation) {
        explanation = `${explanation} ${line}`.trim();
      }
    }

    const statement = statementParts.join(' ').trim();
    if (!statement) return;
    // Skip single-line stray notes with neither options nor answer
    if (options.length === 0 && !rawAnswer) return;

    const correctAnswer = resolveOptionAnswer(rawAnswer, options) || options[0] || '';
    const isMcq = options.length >= 2;

    results.push({
      tempId: makeTempId(idx),
      selected: true,
      statement,
      options: isMcq ? options : [],
      correctAnswer,
      solution: explanation || (correctAnswer ? `Correct answer: ${correctAnswer}` : ''),
      explanation: explanation || 'Imported from text question block.',
      difficulty,
      questionType: isMcq ? 'MCQ' : 'Conceptual',
      year,
    });
  });

  return results;
}

export function parseQuestionsAuto(raw: string, fileName?: string): {
  drafts: ParsedQuestionDraft[];
  formatDetected: 'json' | 'csv' | 'text';
} {
  const trimmed = raw.trim();
  const ext = (fileName || '').toLowerCase();

  if (ext.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const drafts = parseQuestionsFromJson(trimmed);
      if (drafts.length > 0) return { drafts, formatDetected: 'json' };
    } catch {
      // Fall through to text parser
    }
  }

  if (ext.endsWith('.csv') || (/^(?=.*(?:statement|question|prompt))[^\n]*,/i.test(trimmed))) {
    const drafts = parseQuestionsFromCsv(trimmed);
    if (drafts.length > 0) return { drafts, formatDetected: 'csv' };
  }

  return {
    drafts: parseQuestionsFromText(trimmed),
    formatDetected: 'text',
  };
}

export function materializeImportedQuestions(params: {
  drafts: ParsedQuestionDraft[];
  subjectId: string;
  topicId?: string;
  examId?: string;
  source: QuestionSource;
  sourceLabel: string;
  defaultYear?: string;
}): Array<Omit<Question, 'id'>> {
  const { drafts, subjectId, topicId, examId, source, sourceLabel, defaultYear } = params;
  return drafts
    .filter((d) => d.selected && d.statement.trim() && d.correctAnswer.trim())
    .map((d) => ({
      statement: d.statement.trim(),
      options: d.options.length >= 2 ? d.options : undefined,
      correctAnswer: d.correctAnswer.trim(),
      solution: d.solution.trim() || `Correct answer: ${d.correctAnswer.trim()}`,
      explanation: d.explanation.trim() || 'Imported by user.',
      difficulty: d.difficulty,
      subjectId: subjectId || 'general',
      topicId: topicId || undefined,
      examId: examId || undefined,
      year:
        source === 'verified_pyq'
          ? d.year || defaultYear?.trim() || undefined
          : undefined,
      marks: 4,
      negativeMarks: 1,
      questionType: d.questionType,
      source,
      sourceLabel:
        sourceLabel.trim() ||
        (source === 'verified_pyq'
          ? `User-Verified PYQ (${d.year || defaultYear || 'Paper'})`
          : 'User Uploaded Question'),
      bookmarked: false,
    }));
}
