import ExampleGenerator from "../example.js";
import _ from "lodash";

export class ValidatorParser {
  exampleGenerator: ExampleGenerator;
  constructor() {
    this.exampleGenerator = new ExampleGenerator({});
  }
  async validatorToObject(
    validator: any
  ): Promise<Record<string, any>> {
    const obj: Record<string, any> = {
      type: "object",
      ...this.#parseSchema(
        validator.toJSON()["schema"]["schema"],
        validator.toJSON()["refs"]
      ),
    };
    const testObj: Record<string, any> = this.#objToTest(obj["properties"]);
    return await this.#parsePropsAndMeta(obj, testObj, validator);
  }

  async #parsePropsAndMeta(
    obj: Record<string, any>,
    testObj: Record<string, any>,
    validator: any
  ): Promise<Record<string, any>> {
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

    const messages = e.messages;

    for (const message of messages) {
      const error = message["message"];
      let objField = message["field"].replace(".", ".properties.");
      if (message["field"].includes(".0")) {
        objField = objField.replaceAll(`.0`, ".items");
      }
      if (error === "TYPE") {
        _.set(obj["properties"], objField, {
          ..._.get(obj["properties"], objField),
          type: message["rule"],
          example: this.exampleGenerator.exampleByType(message["rule"]),
        });
        if (message["rule"] === "string") {
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
          message["field"],
          this.exampleGenerator.exampleByType(message["rule"])
        );
      }

      if (error === "FORMAT") {
        _.set(obj["properties"], objField, {
          ..._.get(obj["properties"], objField),
          format: message["rule"],
          type: "string",
          example: this.exampleGenerator.exampleByValidatorRule(
            message["rule"]
          ),
        });
        _.set(
          testObj,
          message["field"],
          this.exampleGenerator.exampleByValidatorRule(message["rule"])
        );
      }
    }

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
    for (const property of json["properties"]) {
      let meta = this.#getMetaFromValidations(property["validations"], refs);

      const type = property["type"];
      const field = property["fieldName"];

      if (type === "object") {
        console.log(field, property);
        obj[field] = { type: "object", ...this.#parseSchema(property, refs) };
      } else {
        // if array
        if (type === "array") {
          if (property["each"]["type"] === "object") {
            obj[field] = {
              type: "array",
              items: {
                type: "object",
                ...this.#parseSchema(property["each"], refs),
              },
            };
          } else {
            const meta = this.#getMetaFromValidations(
              property["each"]["validations"],
              refs
            );
            obj[field] = {
              type: "array",
              items: {
                type: this.#getType(property["each"]["type"]),
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
      if (!property["isOptional"]) required.push(property["fieldName"]);
    }
    const result: Record<string, any> = { properties: obj };
    if (required.length > 0) result["required"] = required;
    return result;
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
    for (const validation of validations) {
      if (refs[validation["ruleFnId"]].options?.example) {
        meta = {
          ...meta,
          example: refs[validation["ruleFnId"]].options.example,
        };
      }
      if (refs[validation["ruleFnId"]].options?.min) {
        meta = { ...meta, minimum: refs[validation["ruleFnId"]].options.min };
      }
      if (refs[validation["ruleFnId"]].options?.max) {
        meta = { ...meta, maximum: refs[validation["ruleFnId"]].options.max };
      }
      if (refs[validation["ruleFnId"]].options?.choices) {
        meta = { ...meta, enum: refs[validation["ruleFnId"]].options.choices };
      }
      if (refs[validation["ruleFnId"]].options?.toString().includes("/")) {
        meta = {
          ...meta,
          pattern: refs[validation["ruleFnId"]].options.toString(),
        };
      }
    }
    return meta;
  }
}
