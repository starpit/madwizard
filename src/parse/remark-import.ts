/*
 * Copyright 2022 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Debug from "debug"
import { Element, Node } from "hast"
import { visit } from "unist-util-visit"
import { Node as Node2, toString } from "hast-util-to-string"

const debug = Debug("plugin-client-common/Content/Markdown/remark-import")

/** Extract prereqs from the tree into the frontmatter */
// eslint-disable-next-line @typescript-eslint/no-unused-vars

export interface ImportProps {
  "data-kui-import": "true"
  "data-kui-filepath": string
  "data-kui-import-title": string
  containedCodeBlocks?: string[]
}

export function isImportContainer(node: Node) {
  return node.type === "containerDirective" && node["name"] === "import"
}

export function isOnAnImportChain(ancestors: Node[]) {
  return ancestors.find(isImportContainer)
}

export function isImports(props: Partial<ImportProps>): props is Required<ImportProps> {
  return props && props["data-kui-import"] === "true"
}

export function getImportKey(props: ImportProps) {
  return props["data-kui-filepath"]
}

export function getImportFilepath(props: ImportProps) {
  return getImportKey(props)
}

export function getImportTitle(props: ImportProps) {
  return props["data-kui-import-title"]
}

function isHeading(node: Node): boolean {
  return node.type === "heading"
}

export function visitImportContainers(
  tree,
  visitor: (importProps: {
    node: Element
    title: string
    filepath: string
    provenance: string
    frontmatter: Record<string, any>
    children: Node2[]
  }) => void
) {
  visit(tree, "containerDirective", (node) => {
    if (node.name === "import") {
      debug("container directive import", node.attributes.title, node)
      visitor({
        node,
        title: node.attributes.title,
        filepath: node.attributes.filepath,
        provenance: node.attributes.provenance,
        children: node.children,
        frontmatter:
          typeof node.attributes.attributes !== "string" || node.attributes.attributes.length === 0
            ? {}
            : JSON.parse(decodeURIComponent(node.attributes.attributes)),
      })
    }
  })
}

export function remarkImports() {
  return function transformer(tree /*: Root */) {
    // ::imports is a "leaf directive", and lets guidebook authors
    // choose where to place the Imports UI
    visit(tree, "leafDirective", (node) => {
      if (node.name === "imports") {
        const data = node.data || (node.data = {})
        data.hName = "guidebookimports"
        data.hProperties = {
          "data-kui-code-blocks": [], // rehype-imports will populate this
        }
      } else if (node.name === "guide") {
        const data = node.data || (node.data = {})
        data.hName = "guidebookguide"
        data.hProperties = {
          "data-kui-code-blocks": [], // rehype-imports will populate this
        }
      }
    })

    // :::imports is a "container directive", and is generated by the
    // snippets.md snippet inliner
    visitImportContainers(tree, ({ node, title, filepath, provenance, children }) => {
      node.data = {
        hProperties: {
          containedCodeBlocks: [],
          "data-kui-import": "true",
          "data-kui-filepath": filepath,
          "data-kui-provenance": provenance,
          "data-kui-import-title":
            title || (children[0] && isHeading(children[0]) ? toString(children[0]).replace(/\s*\(\)\s*/g, "") : ""),
        },
      }
    })
  }
}

function rehypeImportsTransformer(tree /*: Root */) {
  if (tree["properties"] && tree["properties"].containedCodeBlocks) {
    // attach the prereq graph to any nodes with a slot for it
    visit(tree, "element", (node) => {
      if (node.properties["data-kui-code-blocks"]) {
        node.properties["data-kui-code-blocks"] = JSON.stringify(tree["properties"].containedCodeBlocks)
      }
    })
  }
}

export default function rehypeImports() {
  return rehypeImportsTransformer
}
