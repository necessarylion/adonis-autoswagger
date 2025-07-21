import ExampleGenerator from "../example";

export class InterfaceParser {
  exampleGenerator: ExampleGenerator;
  snakeCase: boolean;
  schemas: any = {};

  constructor(snakeCase: boolean, schemas: any = {}) {
    this.snakeCase = snakeCase;
    this.exampleGenerator = new ExampleGenerator({});
    this.schemas = schemas;
  }

  objToExample(obj: Record<string, any>): Record<string, any> {
    const example: Record<string, any> = {};
    Object.entries(obj).map(([key, value]) => {
      if (typeof value === "object") {
        example[key] = this.objToExample(value);
      } else {
        example[key] = this.exampleGenerator.exampleByType(value as string);
        if (example[key] === null) {
          example[key] = this.exampleGenerator.exampleByField(key);
        }
      }
    });
    return example;
  }

  parseProps(obj: Record<string, any>): Record<string, any> {
    const newObject: Record<string, any> = {};
    Object.entries(obj).map(([field, value]) => {
      if (typeof value === "object") {
        newObject[field.replaceAll("?", "")] = {
          type: "object",
          nullable: field.includes("?"),
          properties: this.parseProps(value),
          example: this.objToExample(value),
        };
      } else {
        newObject[field.replaceAll("?", "")] = {
          ...this.parseType(value, field),
        };
      }
    });
    return newObject;
  }

  getInheritedProperties(baseType: string): any {
    if (this.schemas[baseType]?.properties) {
      return {
        properties: this.schemas[baseType].properties,
        required: this.schemas[baseType].required || [],
      };
    }

    const cleanType = baseType
      .split("/")
      .pop()
      ?.replace(".ts", "")
      ?.replace(/^[#@]/, "");

    if (!cleanType) return { properties: {}, required: [] };

    if (this.schemas[cleanType]?.properties) {
      return {
        properties: this.schemas[cleanType].properties,
        required: this.schemas[cleanType].required || [],
      };
    }

    const variations = [
      cleanType,
      `#models/${cleanType}`,
      cleanType.replace(/Model$/, ""),
      `${cleanType}Model`,
    ];

    for (const variation of variations) {
      if (this.schemas[variation]?.properties) {
        return {
          properties: this.schemas[variation].properties,
          required: this.schemas[variation].required || [],
        };
      }
    }

    return { properties: {}, required: [] };
  }

  parseInterfaces(fileContent: string): Record<string, any> {
    fileContent = fileContent
      .replace(/\t/g, "")
      .replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");

    let currentInterface: string | null = null;
    const interfaces: Record<string, any> = {};
    const interfaceDefinitions: Map<string, any> = new Map();

    const lines: string[] = fileContent.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isDefault = line.startsWith("export default interface");

      if (
        line.startsWith("interface") ||
        line.startsWith("export interface") ||
        isDefault
      ) {
        const splittedLine = line.split(/\s+/);
        const index = line.endsWith("}")
          ? splittedLine.length - 1
          : splittedLine.length - 2;
        const name = splittedLine[index].split(/[{\s]/)[0];
        const extendedTypes = this.#parseExtends(line);
        interfaceDefinitions.set(name, {
          extends: extendedTypes,
          properties: {},
          required: [],
          startLine: i,
          examples: {},
        });
        currentInterface = name;
        continue;
      }

      if (currentInterface && line === "}") {
        currentInterface = null;
        continue;
      }

      if (
        currentInterface &&
        line &&
        !line.startsWith("//") &&
        !line.startsWith("/*") &&
        !line.startsWith("*")
      ) {
        const definition = interfaceDefinitions.get(currentInterface);
        if (definition) {
          const previousLine = i > 0 ? lines[i - 1].trim() : "";
          const isRequired = previousLine.includes("@required");

          // extract example value from comment @example(john)
          const example = previousLine.match(/@example\((.*)\)/)?.[1];

          const [prop, type] = line.split(":").map((s) => s.trim());
          if (prop && type) {
            const cleanProp = prop.replace("?", "");
            definition.properties[cleanProp] = type.replace(";", "");

            if (isRequired || !prop.includes("?")) {
              definition.required.push(cleanProp);
            }

            if (example) definition.examples[cleanProp] = example;
          }
        }
      }
    }

    for (const [name, definition] of interfaceDefinitions) {
      const allProperties = {};
      const requiredFields = new Set(definition.required);

      for (const baseType of definition.extends) {
        const baseSchema = this.schemas[baseType];
        if (baseSchema) {
          if (baseSchema.properties) {
            Object.assign(allProperties, baseSchema.properties);
          }

          if (baseSchema.required) {
            baseSchema.required.forEach((field) => requiredFields.add(field));
          }
        }
      }

      Object.assign(allProperties, definition.properties);

      const parsedProperties = {};
      for (const [key, value] of Object.entries(allProperties)) {
        if (typeof value === "object" && value !== null && "type" in value) {
          parsedProperties[key] = value;
        } else {
          parsedProperties[key] = this.parseType(value, key);
        }
        if (definition.examples[key]) {
          parsedProperties[key].example = definition.examples[key];
        }
      }

      const schema = {
        type: "object",
        properties: parsedProperties,
        required: Array.from(requiredFields),
        description: `${name}${
          definition.extends.length
            ? ` extends ${definition.extends.join(", ")}`
            : ""
        } (Interface)`,
      };

      if (schema.required.length === 0) {
        delete schema.required;
      }

      interfaces[name] = schema;
    }

    return interfaces;
  }

  #parseExtends(line: string): string[] {
    const matches = line.match(/extends\s+([^{]+)/);
    if (!matches) return [];

    return matches[1]
      .split(",")
      .map((type) => type.trim())
      .map((type) => {
        const cleanType = type.split("/").pop();
        return cleanType?.replace(/\.ts$/, "") || type;
      });
  }

  parseType(type: string | any, field: string) {
    if (typeof type === "object" && type !== null && "type" in type) {
      return type;
    }

    let isArray = false;
    if (typeof type === "string" && type.includes("[]")) {
      type = type.replace("[]", "");
      isArray = true;
    }

    if (typeof type === "string") {
      type = type.replace(/[;\r\n]/g, "").trim();
    }

    const property: any = { type: type };
    const notRequired = field.includes("?");
    property.nullable = notRequired;

    if (typeof type === "string" && type.toLowerCase() === "datetime") {
      property.type = "string";
      property.format = "date-time";
      property.example = "2021-03-23T16:13:08.489+01:00";
    } else if (typeof type === "string" && type.toLowerCase() === "date") {
      property.type = "string";
      property.format = "date";
      property.example = "2021-03-23";
    } else {
      const standardTypes = ["string", "number", "boolean", "integer"];
      if (
        typeof type === "string" &&
        !standardTypes.includes(type.toLowerCase())
      ) {
        delete property.type;
        property.$ref = `#/components/schemas/${type}`;
      } else {
        if (typeof type === "string") {
          property.type = type.toLowerCase();
        }
        property.example =
          this.exampleGenerator.exampleByType(type) ||
          this.exampleGenerator.exampleByField(field);
      }
    }

    if (isArray) {
      return {
        type: "array",
        items: property,
      };
    }

    return property;
  }
}
