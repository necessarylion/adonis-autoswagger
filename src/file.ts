import YAML from "yaml";
import fs from "fs";
import type { options } from "./types";
import { AdonisRoutes } from "./types";

export class FileService {
  /**
   * Convert json to yaml
   * @param json any
   * @returns
   */
  jsonToYaml(json: any) {
    return YAML.stringify(json);
  }

  /**
   * Generate json output
   * @param routes AdonisRoutes
   * @param options options
   * @returns
   */
  async json(
    routes: AdonisRoutes,
    options: options,
    generate: (routes: AdonisRoutes, options: options) => Promise<any>
  ): Promise<any> {
    if (process.env.NODE_ENV === (options.productionEnv || "production")) {
      const str: string = await this.readFile(options.path, "json");
      return JSON.parse(str);
    }
    return generate(routes, options);
  }

  /**
   * Write swagger file
   * @param routes AdonisRoutes
   * @param options options
   */
  async writeFile(
    routes: AdonisRoutes,
    options: options,
    generate: (routes: AdonisRoutes, options: options) => Promise<any>
  ): Promise<void> {
    const json: any = await generate(routes, options);
    const contents: string = this.jsonToYaml(json);
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
  async readFile(
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
  async docs(
    routes: AdonisRoutes,
    options: options,
    generate: (routes: AdonisRoutes, options: options) => Promise<any>
  ): Promise<string> {
    if (process.env.NODE_ENV === (options.productionEnv || "production")) {
      return this.readFile(options.path);
    }
    return this.jsonToYaml(await generate(routes, options));
  }

  /**
   * Get files in directory
   * @param dir string
   * @param files_ string[]
   * @returns
   */
  async getFiles(dir: string, files_?: string[]): Promise<string[]> {
    const fs: any = require("fs");
    files_ = files_ || [];
    var files: string[] = await fs.readdirSync(dir);
    for (let i in files) {
      var name: string = dir + "/" + files[i];
      if (fs.statSync(name).isDirectory()) {
        await this.getFiles(name, files_);
      } else {
        files_.push(name);
      }
    }
    return files_;
  }
}
