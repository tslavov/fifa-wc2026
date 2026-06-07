import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { z } from "zod";

export type CollectorResult<T> = {
  data: T;
  warnings: string[];
};

export type Collector<T> = {
  id: string;
  description: string;
  run: () => Promise<CollectorResult<T>>;
};

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function writeJson<T>(path: string, data: T, schema?: z.ZodType<T>): Promise<void> {
  const parsed = schema ? schema.parse(data) : data;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
