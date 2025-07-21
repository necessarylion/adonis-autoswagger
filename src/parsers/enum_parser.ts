import { startCase } from "lodash-es";

export class EnumParser {
  constructor() {}

  parseEnums(fileContent: string): Record<string, any> {
    const enums: Record<string, any> = {};
    const lines: string[] = fileContent.split("\n");
    let currentEnum: string | null = null;
    let description: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("//")) {
        description = trimmedLine.slice(2).trim();
        continue;
      }

      if (
        trimmedLine.startsWith("enum") ||
        trimmedLine.startsWith("export enum")
      ) {
        const match = trimmedLine.match(/(?:export\s+)?enum\s+(\w+)/);
        if (match) {
          currentEnum = match[1];
          enums[currentEnum] = {
            type: "string",
            enum: [],
            properties: {},
            description: description || `${startCase(currentEnum)} enumeration`,
          };
          description = null;
        }
        continue;
      }

      if (currentEnum && trimmedLine !== "{" && trimmedLine !== "}") {
        const [key, value] = trimmedLine.split("=").map((s) => s.trim());
        if (key) {
          const enumValue = value ? this.#parseEnumValue(value) : key;
          enums[currentEnum].enum.push(enumValue);
        }
      }

      if (trimmedLine === "}") {
        currentEnum = null;
      }
    }

    return enums;
  }

  #parseEnumValue(value: string): string {
    // Remove quotes and comma
    return value.replace(/['",]/g, "").trim();
  }
}
