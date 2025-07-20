import { serializeV6Middleware, serializeV6Handler } from "./adonis_helpers";
import {
  InterfaceParser,
  ModelParser,
  CommentParser,
  RouteParser,
  ValidatorParser,
  EnumParser,
} from "./parsers/index";
import _, { isEmpty, isUndefined } from "lodash";

import type { options, AdonisRoutes, v6Handler, AdonisRoute } from "./types";

import { mergeParams, formatOperationId } from "./helpers";
import ExampleGenerator, { ExampleInterfaces } from "./example";
import path from "path";
import fs from "fs";
import { startCase } from "lodash";
import HTTPStatusCode from "http-status-code";
import { UI } from "./ui";
import { File } from "./file";
import { Schema } from "./schema";

class AutoSwagger extends Schema {
  declare protected options: options;
  declare protected schemas: Record<string, any>;
  declare protected commentParser: CommentParser;
  declare protected modelParser: ModelParser;
  declare protected interfaceParser: InterfaceParser;
  declare protected enumParser: EnumParser;
  declare protected routeParser: RouteParser;
  declare protected validatorParser: ValidatorParser;
  declare protected customPaths: Record<string, any>;


  /**
   * Get data based on adonis version
   * @param route AdonisRoute
   * @returns
   */
  private async getDataBasedOnAdonisVersion(route: AdonisRoute) {
    let sourceFile: string = "";
    let action: string = "";
    let customAnnotations: Record<string, any>;
    let operationId: string = "";
    if (
      route.meta.resolvedHandler !== null &&
      route.meta.resolvedHandler !== undefined
    ) {
      if (
        typeof route.meta.resolvedHandler.namespace !== "undefined" &&
        route.meta.resolvedHandler.method !== "handle"
      ) {
        sourceFile = route.meta.resolvedHandler.namespace;

        action = route.meta.resolvedHandler.method;
        // If not defined by an annotation, use the combination of "controllerNameMethodName"
        if (action !== "" && isUndefined(operationId) && route.handler) {
          operationId = formatOperationId(route.handler as string);
        }
      }
    }

    let v6handler: v6Handler = <v6Handler>route.handler;
    if (
      v6handler.reference !== null &&
      v6handler.reference !== undefined &&
      v6handler.reference !== ""
    ) {
      if (!Array.isArray(v6handler.reference)) {
        // handles magic strings
        // router.resource('/test', '#controllers/test_controller')
        [sourceFile, action] = (v6handler.reference as string).split(".");
        const split: string[] = sourceFile.split("/");

        if (split[0].includes("#")) {
          sourceFile = sourceFile.replaceAll(
            split[0],
            this.customPaths[split[0]]
          );
        } else {
          sourceFile = this.options.appPath + "/controllers/" + sourceFile;
        }
        operationId = formatOperationId(v6handler.reference);
      } else {
        // handles lazy import
        // const TestController = () => import('#controllers/test_controller')
        v6handler = await serializeV6Handler(v6handler);
        action = v6handler.method;
        sourceFile = v6handler.moduleNameOrPath;
        operationId = formatOperationId(sourceFile + "." + action);
        const split: string[] = sourceFile.split("/");
        if (split[0].includes("#")) {
          sourceFile = sourceFile.replaceAll(
            split[0],
            this.customPaths[split[0]]
          );
        } else {
          sourceFile = this.options.appPath + "/" + sourceFile;
        }
      }
    }

    if (sourceFile !== "" && action !== "") {
      sourceFile = sourceFile.replace("App/", "app/") + ".ts";
      sourceFile = sourceFile.replace(".js", "");

      customAnnotations = await this.commentParser.getAnnotations(
        sourceFile,
        action
      );
    }
    if (
      typeof customAnnotations !== "undefined" &&
      typeof customAnnotations.operationId !== "undefined" &&
      customAnnotations.operationId !== ""
    ) {
      operationId = customAnnotations.operationId;
    }
    if (this.options.debug) {
      if (sourceFile !== "") {
        console.log(
          typeof customAnnotations !== "undefined" &&
            !_.isEmpty(customAnnotations)
            ? `\x1b[32m✓ FOUND for ${action}\x1b[0m`
            : `\x1b[33m✗ MISSING for ${action}\x1b[0m`,

          `${sourceFile} (${route.methods[0].toUpperCase()} ${route.pattern})`
        );
      }
    }
    return { sourceFile, action, customAnnotations, operationId };
  }
}

function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
          Object.create(null)
      );
    });
  });
}

interface AutoSwagger extends UI, File, Schema {}
applyMixins(AutoSwagger, [UI, File, Schema]);

export { AutoSwagger };
