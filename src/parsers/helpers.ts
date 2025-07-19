import { camelCase, startCase } from "lodash";

/**
 * Check if a string is a valid JSON
 * @param str string
 * @returns
 */
export function isJSONString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get string between brackets
 * @param value string
 * @param start string
 * @returns
 */
export function getBetweenBrackets(value: string, start: string) {
  let match = value.match(new RegExp(start + "\\(([^()]*)\\)", "g"));

  if (match !== null) {
    let m = match[0].replace(start + "(", "").replace(")", "");

    if (start !== "example") {
      m = m.replace(/ /g, "");
    }
    if (start === "paginated") {
      return "true";
    }
    return m;
  }

  return "";
}
