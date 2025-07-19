import path from "path";
import util from "util";
import fs from "fs";
import { existsSync } from "fs";
import {
  InterfaceParser,
  ModelParser,
  ValidatorParser,
  EnumParser,
} from "./parsers/index";
import { ExampleInterfaces } from "./example";
import { getFiles } from "./file";

/**
 * Get all schemas
 * @returns
 */
export async function getSchemas(): Promise<Record<string, any>> {
  let schemas: Record<string, any> = {
    Any: {
      description: "Any JSON object not defined as schema",
    },
  };

  schemas = {
    ...schemas,
    ...(await getInterfaces.bind(this)()),
    ...(await getSerializers.bind(this)()),
    ...(await getModels.bind(this)()),
    ...(await getValidators.bind(this)()),
    ...(await getEnums.bind(this)()),
  };

  return schemas;
}

/**
 * Get all validators
 * @returns
 */
export async function getValidators(): Promise<Record<string, any>> {
  const validators: Record<string, any> = {};
  let p6: string = path.join(this.options.appPath, "validators");

  if (typeof this.customPaths["#validators"] !== "undefined") {
    // it's v6
    p6 = p6.replaceAll("app/validators", this.customPaths["#validators"]);
    p6 = p6.replaceAll("app\\validators", this.customPaths["#validators"]);
  }

  if (!existsSync(p6)) {
    if (this.options.debug) {
      console.log("Validators paths don't exist", p6);
    }
    return validators;
  }

  const files = await getFiles.bind(this)(p6, []);
  if (this.options.debug) {
    console.log("Found validator files", files);
  }

  try {
    for (let file of files) {
      if (/^[a-zA-Z]:/.test(file)) {
        file = "file:///" + file;
      }

      const val = await import(file);
      for (const [key, value] of Object.entries(val)) {
        if (value.constructor.name.includes("VineValidator")) {
          validators[key] = await this.validatorParser.validatorToObject(
            value
          );
          validators[key].description = key + " (Validator)";
        }
      }
    }
  } catch (e) {
    console.log(
      "**You are probably using 'node ace serve --hmr', which is not supported yet. Use 'node ace serve --watch' instead.**"
    );
    console.error(e.message);
  }

  return validators;
}

/**
 * Get all serializers
 * @returns
 */
export async function getSerializers(): Promise<Record<string, any>> {
  const serializers: Record<string, any> = {};
  let p6: string = path.join(this.options.appPath, "serializers");

  if (typeof this.customPaths["#serializers"] !== "undefined") {
    // it's v6
    p6 = p6.replaceAll("app/serializers", this.customPaths["#serializers"]);
    p6 = p6.replaceAll("app\\serializers", this.customPaths["#serializers"]);
  }

  if (!existsSync(p6)) {
    if (this.options.debug) {
      console.log("Serializers paths don't exist", p6);
    }
    return serializers;
  }

  const files = await getFiles.bind(this)(p6, []);
  if (this.options.debug) {
    console.log("Found serializer files", files);
  }

  for (let file of files) {
    if (/^[a-zA-Z]:/.test(file)) {
      file = "file:///" + file;
    }

    const val = await import(file);

    for (const [key, value] of Object.entries(val)) {
      if (key.indexOf("Serializer") > -1) {
        serializers[key] = value;
      }
    }
  }

  return serializers;
}

/**
 * Get all models
 * @returns
 */
export async function getModels(): Promise<Record<string, any>> {
  const models: Record<string, any> = {};
  let p: string = path.join(this.options.appPath, "Models");
  let p6: string = path.join(this.options.appPath, "models");

  if (typeof this.customPaths["#models"] !== "undefined") {
    // it's v6
    p6 = p6.replaceAll("app/models", this.customPaths["#models"]);
    p6 = p6.replaceAll("app\\models", this.customPaths["#models"]);
  }

  if (!existsSync(p) && !existsSync(p6)) {
    if (this.options.debug) {
      console.log("Model paths don't exist", p, p6);
    }
    return models;
  }
  if (existsSync(p6)) {
    p = p6;
  }
  const files = await getFiles.bind(this)(p, []);
  const readFile = util.promisify(fs.readFile);
  if (this.options.debug) {
    console.log("Found model files", files);
  }
  for (let file of files) {
    file = file.replace(".js", "");
    const data = await readFile(file, "utf8");
    file = file.replace(".ts", "");
    const split = file.split("/");
    let name = split[split.length - 1].replace(".ts", "");
    file = file.replace("app/", "/app/");
    const parsed = this.modelParser.parseModelProperties(data);
    if (parsed.name !== "") {
      name = parsed.name;
    }
    let schema = {
      type: "object",
      properties: parsed.props,
      description: name + " (Model)",
    };
    if (parsed.required.length > 0) {
      schema["required"] = parsed.required;
    }
    if (name.toLowerCase().includes("readme.md")) continue;
    models[name] = schema;
  }
  return models;
}

/**
 * Get all interfaces
 * @returns
 */
export async function getInterfaces(): Promise<Record<string, any>> {
  let interfaces: Record<string, any> = {
    ...ExampleInterfaces.paginationInterface(),
  };
  let p: string = path.join(this.options.appPath, "Interfaces");
  let p6: string = path.join(this.options.appPath, "interfaces");

  if (typeof this.customPaths["#interfaces"] !== "undefined") {
    // it's v6
    p6 = p6.replaceAll("app/interfaces", this.customPaths["#interfaces"]);
    p6 = p6.replaceAll("app\\interfaces", this.customPaths["#interfaces"]);
  }

  if (!existsSync(p) && !existsSync(p6)) {
    if (this.options.debug) {
      console.log("Interface paths don't exist", p, p6);
    }
    return interfaces;
  }
  if (existsSync(p6)) {
    p = p6;
  }
  const files = await getFiles.bind(this)(p, []);
  if (this.options.debug) {
    console.log("Found interfaces files", files);
  }
  const readFile = util.promisify(fs.readFile);
  for (let file of files) {
    file = file.replace(".js", "");
    const data = await readFile(file, "utf8");
    file = file.replace(".ts", "");
    interfaces = {
      ...interfaces,
      ...this.interfaceParser.parseInterfaces(data),
    };
  }

  return interfaces;
}

/**
 * Get all enums
 * @returns
 */
export async function getEnums(): Promise<Record<string, any>> {
  let enums: Record<string, any> = {};

  const enumParser = new EnumParser();

  let p: string = path.join(this.options.appPath, "Types");
  let p6: string = path.join(this.options.appPath, "types");

  if (typeof this.customPaths["#types"] !== "undefined") {
    // it's v6
    p6 = p6.replaceAll("app/types", this.customPaths["#types"]);
    p6 = p6.replaceAll("app\\types", this.customPaths["#types"]);
  }

  if (!existsSync(p) && !existsSync(p6)) {
    if (this.options.debug) {
      console.log("Enum paths don't exist", p, p6);
    }
    return enums;
  }

  if (existsSync(p6)) {
    p = p6;
  }

  const files = await getFiles.bind(this)(p, []);
  if (this.options.debug) {
    console.log("Found enum files", files);
  }

  const readFile = util.promisify(fs.readFile);
  for (let file of files) {
    file = file.replace(".js", "");
    const data = await readFile(file, "utf8");
    file = file.replace(".ts", "");
    const split = file.split("/");
    const name = split[split.length - 1].replace(".ts", "");
    file = file.replace("app/", "/app/");

    const parsedEnums = enumParser.parseEnums(data);
    enums = {
      ...enums,
      ...parsedEnums,
    };
  }

  return enums;
}
