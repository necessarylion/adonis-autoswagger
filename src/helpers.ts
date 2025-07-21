/**
 * Check if a string is a valid JSON
 */
import { camelCase, startCase } from "lodash";

/**
 * Merge params
 * @param initial any
 * @param custom any
 * @returns
 */
export function mergeParams(initial: any, custom: any) {
  let merge = Object.assign(initial, custom);
  let params: any[] = [];
  for (const [key, value] of Object.entries(merge)) {
    params.push(value);
  }

  return params;
}

/**
 * Helpers
 */

/**
 * Format operation id
 * @param inputString string
 * @returns
 */
export function formatOperationId(inputString: string): string {
  // Remove non-alphanumeric characters and split the string into words
  const cleanedWords = inputString.replace(/[^a-zA-Z0-9]/g, " ").split(" ");

  // Pascal casing words
  const pascalCasedWords = cleanedWords.map((word) =>
    startCase(camelCase(word))
  );

  // Generate operationId by joining every parts
  const operationId = pascalCasedWords.join();

  // CamelCase the operationId
  return camelCase(operationId);
}
