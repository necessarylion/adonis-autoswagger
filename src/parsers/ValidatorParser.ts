// @ts-expect-error moduleResolution:nodenext issue 54523
import { VineValidator } from "@vinejs/vine";
import ExampleGenerator from "../example";
import _ from "lodash";

export class ValidatorParser {
  exampleGenerator: ExampleGenerator;
  constructor() {
    this.exampleGenerator = new ExampleGenerator({});
  }
  async validatorToObject(
    validator: VineValidator<any, any>
  ): Promise<Record<string, any>> {
    // console.dir(validator.toJSON()["refs"], { depth: null });
    // console.dir(json, { depth: null });
    const obj: Record<string, any> = {
      type: "object",
      ...this.#parseSchema(
        validator.toJSON()["schema"]["schema"],
        validator.toJSON()["refs"]
      ),
    };
    // console.dir(obj, { depth: null });
    const testObj: Record<string, any> = this.#objToTest(obj["properties"]);
    return await this.#parsePropsAndMeta(obj, testObj, validator);
  }

  async #parsePropsAndMeta(
    obj: Record<string, any>,
    testObj: Record<string, any>,
    validator: VineValidator<any, any>
  ): Promise<Record<string, any>> {
    // console.log(Object.keys(errors));
    const { SimpleMessagesProvider } = await import("@vinejs/vine");
    const [e] = await validator.tryValidate(testObj, {
      messagesProvider: new SimpleMessagesProvider({
        required: "REQUIRED",
        string: "TYPE",
        object: "TYPE",
        number: "TYPE",
        boolean: "TYPE",
      }),
    });

    // if no errors, this means all object-fields are of type number (which we use by default)
    // and we can return the object
    if (e === null) {
      obj["example"] = testObj;
      return obj;
    }

    const msgs = e.messages;

    for (const m of msgs) {
      const err = m["message"];
      let objField = m["field"].replace(".", ".properties.");
      if (m["field"].includes(".0")) {
        objField = objField.replaceAll(`.0`, ".items");
      }
      if (err === "TYPE") {
        _.set(obj["properties"], objField, {
          ..._.get(obj["properties"], objField),
          type: m["rule"],
          example: this.exampleGenerator.exampleByType(m["rule"]),
        });
        if (m["rule"] === "string") {
          if (_.get(obj["properties"], objField)["minimum"]) {
            _.set(obj["properties"], objField, {
              ..._.get(obj["properties"], objField),
              minLength: _.get(obj["properties"], objField)["minimum"],
            });
            _.unset(obj["properties"], objField + ".minimum");
          }
          if (_.get(obj["properties"], objField)["maximum"]) {
            _.set(obj["properties"], objField, {
              ..._.get(obj["properties"], objField),
              maxLength: _.get(obj["properties"], objField)["maximum"],
            });
            _.unset(obj["properties"], objField + ".maximum");
          }
        }

        _.set(
          testObj,
          m["field"],
          this.exampleGenerator.exampleByType(m["rule"])
        );
      }

      if (err === "FORMAT") {
        _.set(obj["properties"], objField, {
          ..._.get(obj["properties"], objField),
          format: m["rule"],
          type: "string",
          example: this.exampleGenerator.exampleByValidatorRule(m["rule"]),
        });
        _.set(
          testObj,
          m["field"],
          this.exampleGenerator.exampleByValidatorRule(m["rule"])
        );
      }
    }

    // console.dir(obj, { depth: null });
    obj["example"] = testObj;
    return obj;
  }

  #objToTest(obj: Record<string, any>): Record<string, any> {
    const res: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key]["type"] === "object") {
        res[key] = this.#objToTest(obj[key]["properties"]);
      } else if (obj[key]["type"] === "array") {
        if (obj[key]["items"]["type"] === "object") {
          res[key] = [this.#objToTest(obj[key]["items"]["properties"])];
        } else {
          res[key] = [obj[key]["items"]["example"]];
        }
      } else {
        res[key] = obj[key]["example"];
      }
    });
    return res;
  }

  #parseSchema(json: any, refs: any): Record<string, any> {
    const obj: Record<string, any> = {};
    const required: any[] = [];
    for (const p of json["properties"]) {
      let meta = this.#getMetaFromValidations(p["validations"], refs);
      // console.dir(p, { depth: null });
      // console.dir(validations, { depth: null });
      // console.log(min, max, choices, regex);

      const type = p["type"];
      const field = p["fieldName"];

      if (type === "object") {
        console.log(field, p);
        obj[field] = { type: "object", ...this.#parseSchema(p, refs) };
      } else {
        // if array
        if (type === "array") {
          if (p["each"]["type"] === "object") {
            obj[field] = {
              type: "array",
              items: {
                type: "object",
                ...this.#parseSchema(p["each"], refs),
              },
            };
          } else {
            const meta = this.#getMetaFromValidations(
              p["each"]["validations"],
              refs
            );
            obj[field] = {
              type: "array",
              items: {
                type: this.#getType(p["each"]["type"]),
                ...meta,
                example:
                  meta.example ??
                  meta.minimum ??
                  this.exampleGenerator.exampleByType("number"),
              },
            };
          }
        } else {
          obj[field] = {
            type: this.#getType(type),
            example:
              meta.example ??
              meta.minimum ??
              this.exampleGenerator.exampleByType("number"),
            ...meta,
          };
        }
      }
      if (!p["isOptional"]) required.push(p["fieldName"]);
    }
    const res: Record<string, any> = { properties: obj };
    if (required.length > 0) res["required"] = required;
    return res;
  }

  #getType(type: string) {
    if (type == "literal") {
      return "string";
    }
    return type;
  }

  #getMetaFromValidations(
    validations: any[],
    refs: any
  ): {
    minimum?: number;
    maximum?: number;
    enum?: any;
    pattern?: string;
    example?: any;
  } {
    let meta: {
      minimum?: number;
      maximum?: number;
      enum?: any;
      pattern?: string;
      example?: any;
    } = {};
    for (const v of validations) {
      if (refs[v["ruleFnId"]].options?.example) {
        meta = { ...meta, example: refs[v["ruleFnId"]].options.example };
      }
      if (refs[v["ruleFnId"]].options?.min) {
        meta = { ...meta, minimum: refs[v["ruleFnId"]].options.min };
      }
      if (refs[v["ruleFnId"]].options?.max) {
        meta = { ...meta, maximum: refs[v["ruleFnId"]].options.max };
      }
      if (refs[v["ruleFnId"]].options?.choices) {
        meta = { ...meta, enum: refs[v["ruleFnId"]].options.choices };
      }
      if (refs[v["ruleFnId"]].options?.toString().includes("/")) {
        meta = { ...meta, pattern: refs[v["ruleFnId"]].options.toString() };
      }
    }
    return meta;
  }
}
