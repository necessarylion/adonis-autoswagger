import { scalarCustomCss } from "./scalar_custom_css";
import type { options } from "./types";

export class UI {
  /**
   * Swagger UI
   * @param url string
   * @param options options
   * @returns
   */
  ui(url: string, options?: options) {
    const persistAuthString = options?.persistAuthorization
      ? "persistAuthorization: true,"
      : "";
    return `<!DOCTYPE html>
		<html lang="en">
		<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="X-UA-Compatible" content="ie=edge">
				<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.3/swagger-ui-standalone-preset.js"></script>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.3/swagger-ui-bundle.js"></script>
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.3/swagger-ui.css" />
				<title>Documentation</title>
		</head>
		<body>
				<div id="swagger-ui"></div>
				<script>
						window.onload = function() {
							SwaggerUIBundle({
								url: "${url}",
								dom_id: '#swagger-ui',
								presets: [
									SwaggerUIBundle.presets.apis,
									SwaggerUIStandalonePreset
								],
								layout: "BaseLayout",
                ${persistAuthString}
							})
						}
				</script>
		</body>
		</html>`;
  }

  /**
   * Rapidoc UI
   * @param url string
   * @param style string
   * @returns
   */
  rapidoc(url: string, style = "view") {
    return (
      `
    <!doctype html> <!-- Important: must specify -->
    <html>
      <head>
        <meta charset="utf-8"> <!-- Important: rapi-doc uses utf8 characters -->
        <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
        <title>Documentation</title>
      </head>
      <body>
        <rapi-doc
          spec-url = "` +
      url +
      `"
      theme = "dark"
      bg-color = "#24283b"
      schema-style="tree"
      schema-expand-level = "10"
      header-color = "#1a1b26"
      allow-try = "true"
      nav-hover-bg-color = "#1a1b26"
      nav-bg-color = "#24283b"
      text-color = "#c0caf5"
      nav-text-color = "#c0caf5"
      primary-color = "#9aa5ce"
      heading-text = "Documentation"
      sort-tags = "true"
      render-style = "` +
      style +
      `"
      default-schema-tab = "example"
      show-components = "true"
      allow-spec-url-load = "false"
      allow-spec-file-load = "false"
      sort-endpoints-by = "path"

        > </rapi-doc>
      </body>
    </html>
    `
    );
  }

  /**
   * Scalar UI
   * @param url string
   * @param proxyUrl string
   * @returns
   */
  scalar(url: string, proxyUrl: string = "https://proxy.scalar.com") {
    return `
      <!doctype html>
      <html>
        <head>
          <title>API Reference</title>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1" />
          <style>
          ${scalarCustomCss}
          </style>
        </head>
        <body>
          <script
            id="api-reference"
            data-url="${url}"
            data-proxy-url="${proxyUrl}"></script>
          <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
        </body>
      </html>
    `;
  }

  /**
   * Stoplight UI
   * @param url string
   * @param theme "light" | "dark"
   * @returns
   */
  stoplight(url: string, theme: "light" | "dark" = "dark") {
    return `
      <!doctype html>
      <html data-theme="${theme}">
        <head>
          <title>API Documentation - Stoplight</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
		  <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
          <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
        </head>
        <body style="min-height:100vh">
	      <elements-api
		    style="display:block;height:100vh;width:100%;"
		    apiDescriptionUrl=${url}
		    router="hash"
		    layout="sidebar"
		  />
        </body>
      </html>
    `;
  }
}
