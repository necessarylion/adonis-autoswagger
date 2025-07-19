import HTTPStatusCode from "http-status-code";
import { isJSONString, getBetweenBrackets } from "../helpers";
import util from "util";
import extract from "extract-comments";
import fs from "fs";
import _ from "lodash";
import ExampleGenerator from "../example";
import type { options } from "../types";

export class CommentParser {
  private parsedFiles: { [file: string]: string } = {};
  public exampleGenerator: ExampleGenerator;

  options: options;

  constructor(options: options) {
    this.options = options;
  }

  #parseAnnotations(lines: string[]): {
    description: string;
    responses: Record<string, any>;
    requestBody: any;
    parameters: Record<string, any>;
    summary: string;
    operationId: any;
    tag: string;
  } {
    let summary: string = "";
    let tag: string = "";
    let description: string = "";
    let operationId: any;
    let responses: Record<string, any> = {};
    let requestBody: any;
    let parameters: Record<string, any> = {};
    let headers: Record<string, any> = {};
    lines.forEach((line) => {
      if (line.startsWith("@summary")) {
        summary = line.replace("@summary ", "");
      }
      if (line.startsWith("@tag")) {
        tag = line.replace("@tag ", "");
      }

      if (line.startsWith("@description")) {
        description = line.replace("@description ", "");
      }

      if (line.startsWith("@operationId")) {
        operationId = line.replace("@operationId ", "");
      }

      if (line.startsWith("@responseBody")) {
        responses = {
          ...responses,
          ...this.#parseResponseBody(line),
        };
      }
      if (line.startsWith("@responseHeader")) {
        const header = this.#parseResponseHeader(line);
        if (header === null) {
          console.error("Error with line: " + line);
          return;
        }
        headers[header["status"]] = {
          ...headers[header["status"]],
          ...header["header"],
        };
      }
      if (line.startsWith("@requestBody")) {
        requestBody = this.#parseBody(line, "requestBody");
      }
      if (line.startsWith("@requestFormDataBody")) {
        const parsedBody = this.#parseRequestFormDataBody(line);
        if (parsedBody) {
          requestBody = parsedBody;
        }
      }
      if (line.startsWith("@param")) {
        parameters = { ...parameters, ...this.#parseParam(line) };
      }
    });

    for (const [key, value] of Object.entries(responses)) {
      if (typeof headers[key] !== undefined) {
        responses[key]["headers"] = headers[key];
      }
      if (!responses[key]["description"]) {
        responses[key][
          "description"
        ] = `Returns **${key}** (${HTTPStatusCode.getMessage(key)}) as **${
          Object.entries(responses[key]["content"])[0][0]
        }**`;
      }
    }

    return {
      description,
      responses,
      requestBody,
      parameters,
      summary,
      operationId,
      tag,
    };
  }

  #parseParam(line: string): Record<string, any> {
    let where: string = "path";
    let required: boolean = true;
    let type: string = "string";
    let example: any = null;
    let enums: any[] = [];

    if (line.startsWith("@paramUse")) {
      let use = getBetweenBrackets(line, "paramUse");
      const used = use.split(",");
      let h: any[] = [];
      used.forEach((u) => {
        if (typeof this.options.common.parameters[u] === "undefined") {
          return;
        }
        const common = this.options.common.parameters[u];
        h = [...h, ...common];
      });

      return h;
    }

    if (line.startsWith("@paramPath")) {
      required = true;
    }
    if (line.startsWith("@paramQuery")) {
      required = false;
    }

    let m = line.match("@param([a-zA-Z]*)");
    if (m !== null) {
      where = m[1].toLowerCase();
      line = line.replace(m[0] + " ", "");
    }

    let [param, des, meta] = line.split(" - ");
    if (typeof param === "undefined") {
      return;
    }
    if (typeof des === "undefined") {
      des = "";
    }

    if (typeof meta !== "undefined") {
      if (meta.includes("@required")) {
        required = true;
      }
      let en = getBetweenBrackets(meta, "enum");
      example = getBetweenBrackets(meta, "example");
      const mtype = getBetweenBrackets(meta, "type");
      if (mtype !== "") {
        type = mtype;
      }
      if (en !== "") {
        enums = en.split(",");
        example = enums[0];
      }
    }

    let p = {
      in: where,
      name: param,
      description: des,
      schema: {
        example: example,
        type: type,
      },
      required: required,
    };

    if (enums.length > 1) {
      p["schema"]["enum"] = enums;
    }

    return { [param]: p };
  }

  #parseResponseHeader(
    responseLine: string
  ): Record<string, any> | null {
    let description: string = "";
    let example: any = "";
    let type: string = "string";
    let enums: any[] = [];
    const line: string = responseLine.replace("@responseHeader ", "");
    let [status, name, desc, meta]: string[] = line.split(" - ");

    if (typeof status === "undefined" || typeof name === "undefined") {
      return null;
    }

    if (typeof desc !== "undefined") {
      description = desc;
    }

    if (name.includes("@use")) {
      let use = getBetweenBrackets(name, "use");
      const used = use.split(",");
      let h = {};
      used.forEach((u) => {
        if (typeof this.options.common.headers[u] === "undefined") {
          return;
        }
        const common = this.options.common.headers[u];
        h = { ...h, ...common };
      });

      return {
        status: status,
        header: h,
      };
    }

    if (typeof meta !== "undefined") {
      example = getBetweenBrackets(meta, "example");
      const mtype = getBetweenBrackets(meta, "type");
      if (mtype !== "") {
        type = mtype;
      }
    }

    if (example === "" || example === null) {
      switch (type) {
        case "string":
          example = "string";
          break;
        case "integer":
          example = 1;
          break;
        case "float":
          example = 1.5;
          break;
      }
    }

    let h = {
      schema: { type: type, example: example },
      description: description,
    };

    if (enums.length > 1) {
      h["schema"]["enum"] = enums;
    }
    return {
      status: status,
      header: {
        [name]: h,
      },
    };
  }

  #parseResponseBody(responseLine: string): Record<string, any> {
    let responses: Record<string, any> = {};
    const line: string = responseLine.replace("@responseBody ", "");
    let [status, res, desc]: string[] = line.split(" - ");
    if (typeof status === "undefined") return;
    responses[status] = this.#parseBody(res, "responseBody");
    responses[status]["description"] = desc;
    return responses;
  }

  #parseRequestFormDataBody(
    rawLine: string
  ): Record<string, any> | undefined {
    const line: string = rawLine.replace("@requestFormDataBody ", "");
    let json: Record<string, any> = {},
      required: any[] = [];
    const isJson: boolean = isJSONString(line);
    if (!isJson) {
      // try to get json from reference
      let rawRef = line.substring(line.indexOf("<") + 1, line.lastIndexOf(">"));

      const cleandRef = rawRef.replace("[]", "");
      if (cleandRef === "") {
        return;
      }
      const parsedRef = this.exampleGenerator.parseRef(line, true);
      let props: any[] = [];
      const ref = this.exampleGenerator.schemas[cleandRef];
      const ks: any[] = [];
      if (ref.required && Array.isArray(ref.required))
        required.push(...ref.required);
      Object.entries(ref.properties).map(([key, value]) => {
        if (typeof parsedRef[key] === "undefined") {
          return;
        }
        ks.push(key);
        if (value["required"]) required.push(key);
        props.push({
          [key]: {
            type:
              typeof value["type"] === "undefined" ? "string" : value["type"],
            format:
              typeof value["format"] === "undefined"
                ? "string"
                : value["format"],
          },
        });
      });
      const p = props.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      const appends = Object.keys(parsedRef).filter((k) => !ks.includes(k));
      json = p;
      if (appends.length > 0) {
        appends.forEach((a) => {
          json[a] = parsedRef[a];
        });
      }
    } else {
      json = JSON.parse(line);
      for (let key in json) {
        if (json[key].required === "true") {
          required.push(key);
        }
      }
    }
    // No need to try/catch this JSON.parse as we already did that in the isJSONString function

    return {
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: json,
            required,
          },
        },
      },
    };
  }

  #parseBody(rawLine: string, type: string): Record<string, any> {
    let line: string = rawLine.replace(`@${type} `, "");

    const isJson: boolean = isJSONString(line);

    if (isJson) {
      // No need to try/catch this JSON.parse as we already did that in the isJSONString function
      const json = JSON.parse(line);
      const o = this.#jsonToObj(json);
      return {
        content: {
          "application/json": {
            schema: {
              type: Array.isArray(json) ? "array" : "object",
              ...(Array.isArray(json)
                ? { items: this.#arrayItems(json) }
                : o),
            },

            example: this.exampleGenerator.jsonToRef(json),
          },
        },
      };
    }
    return this.exampleGenerator.parseRef(line);
  }

  #arrayItems(json: any[]): Record<string, any> {
    const oneOf: any[] = [];

    const t: string = typeof json[0];

    if (t === "string") {
      json.forEach((j) => {
        const value = this.exampleGenerator.parseRef(j);

        if (_.has(value, "content.application/json.schema.$ref")) {
          oneOf.push({
            $ref: value["content"]["application/json"]["schema"]["$ref"],
          });
        }
      });
    }

    if (oneOf.length > 0) {
      return { oneOf: oneOf };
    }
    return { type: typeof json[0] };
  }

  #jsonToObj(json: any): Record<string, any> {
    const o: Record<string, any> = {
      type: "object",
      properties: Object.keys(json)
        .map((key) => {
          const t: string = typeof json[key];
          const v: any = json[key];
          let value: any = v;
          if (t === "object") {
            value = this.#jsonToObj(json[key]);
          }
          if (t === "string" && v.includes("<") && v.includes(">")) {
            value = this.exampleGenerator.parseRef(v);
            if (v.includes("[]")) {
              let ref: string = "";
              if (_.has(value, "content.application/json.schema.$ref")) {
                ref = value["content"]["application/json"]["schema"]["$ref"];
              }
              if (_.has(value, "content.application/json.schema.items.$ref")) {
                ref =
                  value["content"]["application/json"]["schema"]["items"][
                    "$" + "ref"
                  ];
              }
              value = {
                type: "array",
                items: {
                  $ref: ref,
                },
              };
            } else {
              value = {
                $ref: value["content"]["application/json"]["schema"]["$ref"],
              };
            }
          }
          return {
            [key]: value,
          };
        })
        .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
    };
    // console.dir(o, { depth: null });
    // console.log(json);
    return o;
  }

  async getAnnotations(
    file: string,
    action: string
  ): Promise<Record<string, any>> {
    let annotations: Record<string, any> = {};
    let newdata: string = "";
    if (typeof file === "undefined") return;

    if (typeof this.parsedFiles[file] !== "undefined") {
      newdata = this.parsedFiles[file];
    } else {
      try {
        const readFile = util.promisify(fs.readFile);
        const data = await readFile(file, "utf8");
        for (const line of data.split("\n")) {
          const l = line.trim();
          if (!l.startsWith("@")) {
            newdata += l + "\n";
          }
        }
        this.parsedFiles[file] = newdata;
      } catch (e) {
        console.error("\x1b[31m✗ File not found\x1b[0m", file);
      }
    }

    const comments = extract(newdata);
    if (comments.length > 0) {
      comments.forEach((comment) => {
        if (comment.type !== "BlockComment") return;
        let lines = comment.value.split("\n").filter((l) => l != "");
        // fix for decorators
        if (lines[0].trim() !== "@" + action) return;
        lines = lines.filter((l) => l != "");

        annotations[action] = this.#parseAnnotations(lines);
      });
    }
    return annotations;
  }
}
