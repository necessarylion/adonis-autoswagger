import YAML from "json-to-pretty-yaml";
import fs from "fs";
import type { options } from "./types";
/**
 * Convert json to yaml
 * @param json any
 * @returns
 */
export function jsonToYaml(json: any) {
  return YAML.stringify(json);
}

import { AdonisRoutes } from "./types";

/**
 * Generate json output
 * @param routes AdonisRoutes
 * @param options options
 * @returns
 */
export async function json(
  routes: AdonisRoutes,
  options: options
): Promise<any> {
  if (process.env.NODE_ENV === (options.productionEnv || "production")) {
    const str: string = await readFile(options.path, "json");
    return JSON.parse(str);
  }
  return await this.generate(routes, options);
}

/**
 * Write swagger file
 * @param routes AdonisRoutes
 * @param options options
 */
export async function writeFile(
  routes: AdonisRoutes,
  options: options
): Promise<void> {
  const json: any = await this.generate(routes, options);
  const contents: string = jsonToYaml(json);
  const filePath: string = options.path + "swagger.yml";
  const filePathJson: string = options.path + "swagger.json";

  fs.writeFileSync(filePath, contents);
  fs.writeFileSync(filePathJson, JSON.stringify(json, null, 2));
}

/**
 * Read swagger file
 * @param rootPath string
 * @param type string
 * @returns
 */
export async function readFile(
  rootPath: string,
  type: string = "yml"
): Promise<string | undefined> {
  const filePath: string = rootPath + "swagger." + type;
  const data: string = fs.readFileSync(filePath, "utf-8");
  if (!data) {
    console.error("Error reading file");
    return;
  }
  return data;
}

/**
 * Generate docs
 * @param routes AdonisRoutes
 * @param options options
 * @returns
 */
export async function docs(
  routes: AdonisRoutes,
  options: options
): Promise<string> {
  if (process.env.NODE_ENV === (options.productionEnv || "production")) {
    return readFile(options.path);
  }
  return jsonToYaml(await this.generate(routes, options));
}

/**
 * Get files in directory
 * @param dir string
 * @param files_ string[]
 * @returns
 */
export async function getFiles(
  dir: string,
  files_?: string[]
): Promise<string[]> {
  const fs: any = require("fs");
  files_ = files_ || [];
  var files: string[] = await fs.readdirSync(dir);
  for (let i in files) {
    var name: string = dir + "/" + files[i];
    if (fs.statSync(name).isDirectory()) {
      await getFiles(name, files_);
    } else {
      files_.push(name);
    }
  }
  return files_;
}
