import type { Response } from 'supertest';

/** `name=value` pairs from Set-Cookie headers, keyed by cookie name. Cleared cookies have value ''. */
export function cookiesFrom(res: Response): Record<string, string> {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const result: Record<string, string> = {};
  for (const line of header ?? []) {
    const [pair = ''] = line.split(';');
    const index = pair.indexOf('=');
    result[pair.slice(0, index)] = decodeURIComponent(pair.slice(index + 1));
  }
  return result;
}

/** The raw Set-Cookie line for one cookie (to assert attributes). */
export function setCookieLine(res: Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((line) => line.startsWith(`${name}=`));
}
