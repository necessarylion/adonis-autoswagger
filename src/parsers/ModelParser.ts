import { snakeCase } from "lodash";
import { isJSONString, getBetweenBrackets } from "./helpers.js";
import ExampleGenerator from "../example.js";
import { standardTypes } from "../types.js";

export class ModelParser {
  exampleGenerator: ExampleGenerator;
  snakeCase: boolean;
  constructor(snakeCase: boolean) {
    this.snakeCase = snakeCase;
    this.exampleGenerator = new ExampleGenerator({});
  }

  parseModelProperties(fileContent: string): {
    name: string;
    props: Record<string, any>;
    required: any[];
  } {
    let props: Record<string, any> = {};
    let required: any[] = [];
    // remove empty lines
    fileContent = fileContent
      .replace(/\t/g, "")
      .replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
    const lines: string[] = fileContent.split("\n");
    let softDelete: boolean = false;
    let name: string = "";
    lines.forEach((line, index) => {
      line = line.trim();
      // skip comments
      if (line.startsWith("export default class")) {
        name = line.split(" ")[3];
      }
      if (
        line.includes("@swagger-softdelete") ||
        line.includes("SoftDeletes")
      ) {
        softDelete = true;
      }

      if (
        line.startsWith("//") ||
        line.startsWith("/*") ||
        line.startsWith("*") ||
        line.startsWith("public static ") ||
        line.startsWith("private static ") ||
        line.startsWith("static ")
      )
        return;

      if (index > 0 && lines[index - 1].includes("serializeAs: null")) return;
      if (index > 0 && lines[index - 1].includes("@no-swagger")) return;
      if (
        !line.startsWith("public ") &&
        !line.startsWith("public get") &&
        !line.includes("declare ")
      )
        return;

      let splittedLine: string[] = [];

      if (line.includes("declare ")) {
        splittedLine = line.split("declare ");
      }
      if (line.startsWith("public ")) {
        if (line.startsWith("public get")) {
          splittedLine = line.split("public get");
          let splittedLine2 = splittedLine[1].replace(/;/g, "").split(":");
        } else {
          splittedLine = line.split("public ");
        }
      }

      let splittedLine2 = splittedLine[1].replace(/;/g, "").split(":");

      let field = splittedLine2[0];
      let type = splittedLine2[1] || "";
      type = type.trim();
      let enums: any[] = [];
      let format = "";
      let keyprops = {};
      let example: any = null;

      if (index > 0 && lines[index - 1].includes("@enum")) {
        const line = lines[index - 1];
        let enumsFromLine = getBetweenBrackets(line, "enum");
        if (enumsFromLine !== "") {
          enums = enumsFromLine.split(",");
          example = enums[0];
        }
      }

      if (index > 0 && lines[index - 1].includes("@format")) {
        const line = lines[index - 1];
        let formatFromLine = getBetweenBrackets(line, "format");
        if (formatFromLine !== "") {
          format = formatFromLine;
        }
      }

      if (index > 0 && lines[index - 1].includes("@example")) {
        const line = lines[index - 1];
        let match = line.match(/example\(([^()]*)\)/g);
        if (match !== null) {
          const exampleFromLine = match[0].replace("example(", "").replace(")", "");
          example = exampleFromLine;
          if (type === "number") {
            example = parseInt(exampleFromLine);
          }
        }
      }

      if (index > 0 && lines[index - 1].includes("@required")) {
        required.push(field);
      }

      if (index > 0 && lines[index - 1].includes("@props")) {
        const line = lines[index - 1].replace("@props", "props");
        const json = getBetweenBrackets(line, "props");
        if (isJSONString(json)) {
          keyprops = JSON.parse(json);
        }
      }

      if (typeof type === "undefined") {
        type = "string";
        format = "";
      }

      field = field.trim();

      type = type.trim();

      //TODO: make oneOf
      if (type.includes(" | ")) {
        const types = type.split(" | ");
        type = types.filter((t) => t !== "null")[0];
      }

      field = field.replace("()", "");
      field = field.replace("get ", "");
      type = type.replace("{", "").trim();

      if (this.snakeCase) {
        field = snakeCase(field);
      }

      let indicator = "type";

      if (example === null) {
        example = "string";
      }

      // if relation to another model
      if (type.includes("typeof")) {
        splittedLine = type.split("typeof ");
        type = "#/components/schemas/" + splittedLine[1].slice(0, -1);
        indicator = "$ref";
      } else {
        if (standardTypes.includes(type.toLowerCase())) {
          type = type.toLowerCase();
        } else {
          // assume its a custom interface
          indicator = "$ref";
          type = "#/components/schemas/" + type;
        }
      }
      type = type.trim();
      let isArray = false;

      if (
        line.includes("HasMany") ||
        line.includes("ManyToMany") ||
        line.includes("HasManyThrough") ||
        type.includes("[]")
      ) {
        isArray = true;
        if (type.slice(type.length - 2, type.length) === "[]") {
          type = type.split("[]")[0];
        }
      }
      if (example === null || example === "string") {
        example =
          this.exampleGenerator.exampleByField(field) ||
          this.exampleGenerator.exampleByType(type);
      }

      if (type === "datetime") {
        indicator = "type";
        type = "string";
        format = "date-time";
      }

      if (type === "date") {
        indicator = "type";
        type = "string";
        format = "date";
      }

      if (type === "uuid") {
        indicator = "type";
        type = "string";
        format = "uuid";
      }

      if (field === "email") {
        indicator = "type";
        type = "string";
        format = "email";
      }
      if (field === "password") {
        indicator = "type";
        type = "string";
        format = "password";
      }

      if (enums.length > 0) {
        indicator = "type";
        type = "string";
      }

      if (type === "any") {
        indicator = "$ref";
        type = "#/components/schemas/Any";
      }

      let prop: Record<string, any> = {};
      if (type === "integer" || type === "number") {
        if (example === null || example === "string") {
          example = Math.floor(Math.random() * 1000);
        }
      }
      if (type === "boolean") {
        example = true;
      }

      prop[indicator] = type;
      prop["example"] = example;
      // if array
      if (isArray) {
        props[field] = { type: "array", items: prop };
      } else {
        props[field] = prop;
        if (format !== "") {
          props[field]["format"] = format;
        }
      }
      Object.entries(keyprops).map(([key, value]) => {
        props[field][key] = value;
      });
      if (enums.length > 0) {
        props[field]["enum"] = enums;
      }
    });

    if (softDelete) {
      props["deleted_at"] = {
        type: "string",
        format: "date-time",
        example: "2021-03-23T16:13:08.489+01:00",
      };
    }

    return { name: name, props: props, required: required };
  }
}
