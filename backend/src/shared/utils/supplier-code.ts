import crypto from 'crypto';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 5;
const MAX_RETRIES = 10;

function generateRandomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, CHARSET.length);
    code += CHARSET[randomIndex];
  }
  return code;
}

export function generateUniqueSupplierCode(existingCodes: Set<string> | string[]): string {
  const codeSet = existingCodes instanceof Set ? existingCodes : new Set(existingCodes);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateRandomCode();
    if (!codeSet.has(code)) {
      return code;
    }
  }

  throw new Error(
    `Failed to generate unique supplier code after ${MAX_RETRIES} attempts. ` +
      `${codeSet.size} codes already exist.`,
  );
}
