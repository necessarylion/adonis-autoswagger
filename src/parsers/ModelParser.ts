import { snakeCase } from "lodash";
import { isJSONString, getBetweenBrackets } from "../helpers";
import ExampleGenerator from "../example";
import { standardTypes } from "../types";

export class ModelParser {
  exampleGenerator: ExampleGenerator;
  snakeCase: boolean;
  constructor(snakeCase: boolean) {
    this.snakeCase = snakeCase;
    this.exampleGenerator = new ExampleGenerator({});
  }

  parseModelProperties(data: string): {
    name: string;
    props: Record<string, any>;
    required: any[];
  } {
    let props: Record<string, any> = {};
    let required: any[] = [];
    // remove empty lines
    data = data.replace(/\t/g, "").replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "");
    const lines: string[] = data.split("\n");
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

      let s: string[] = [];

      if (line.includes("declare ")) {
        s = line.split("declare ");
      }
      if (line.startsWith("public ")) {
        if (line.startsWith("public get")) {
          s = line.split("public get");
          let s2 = s[1].replace(/;/g, "").split(":");
        } else {
          s = line.split("public ");
        }
      }

      let s2 = s[1].replace(/;/g, "").split(":");

      let field = s2[0];
      let type = s2[1] || "";
      type = type.trim();
      let enums: any[] = [];
      let format = "";
      let keyprops = {};
      let example: any = null;

      if (index > 0 && lines[index - 1].includes("@enum")) {
        const l = lines[index - 1];
        let en = getBetweenBrackets(l, "enum");
        if (en !== "") {
          enums = en.split(",");
          example = enums[0];
        }
      }

      if (index > 0 && lines[index - 1].includes("@format")) {
        const l = lines[index - 1];
        let en = getBetweenBrackets(l, "format");
        if (en !== "") {
          format = en;
        }
      }

      if (index > 0 && lines[index - 1].includes("@example")) {
        const l = lines[index - 1];
        let match = l.match(/example\(([^()]*)\)/g);
        if (match !== null) {
          const m = match[0].replace("example(", "").replace(")", "");
          example = m;
          if (type === "number") {
            example = parseInt(m);
          }
        }
      }

      if (index > 0 && lines[index - 1].includes("@required")) {
        required.push(field);
      }

      if (index > 0 && lines[index - 1].includes("@props")) {
        const l = lines[index - 1].replace("@props", "props");
        const j = getBetweenBrackets(l, "props");
        if (isJSONString(j)) {
          keyprops = JSON.parse(j);
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
        s = type.split("typeof ");
        type = "#/components/schemas/" + s[1].slice(0, -1);
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
