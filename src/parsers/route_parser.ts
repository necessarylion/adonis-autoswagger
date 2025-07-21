import type { options } from "#src/types";

export class RouteParser {
  options: options;
  constructor(options: options) {
    this.options = options;
  }

  /*
    extract path-variables, tags and the uri-pattern
  */
  extractInfos(path: string): {
    tags: string[];
    parameters: Record<string, any>;
    pattern: string;
  } {
    let parameters: Record<string, any> = {};
    let pattern: string = "";
    let tags: any[] = [];
    let required: boolean;

    const split = path.split("/");
    if (split.length > this.options.tagIndex) {
      tags = [split[this.options.tagIndex].toUpperCase()];
    }
    split.forEach((part) => {
      if (part.startsWith(":")) {
        required = !part.endsWith("?");
        const param = part.replace(":", "").replace("?", "");
        part = "{" + param + "}";
        parameters = {
          ...parameters,
          [param]: {
            in: "path",
            name: param,
            schema: {
              type: "string",
            },
            required: required,
          },
        };
      }
      pattern += "/" + part;
    });
    if (pattern.endsWith("/")) {
      pattern = pattern.slice(0, -1);
    }
    return { tags, parameters, pattern };
  }
}
