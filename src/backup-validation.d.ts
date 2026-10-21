import type { ExportPayload } from './db';
export function validateExportPayload(value: unknown): value is ExportPayload;
