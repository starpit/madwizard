/*
 * Copyright 2023 The Kubernetes Authors
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

import { join } from "path"

import promiseEach from "../../../../util/promise-each.js"
import type { MadWizardOptions } from "../../../MadWizardOptions.js"

export type Items = {
  title?: string
  description?: string
  items: string[]
}

export default async function ls(filepath: string, options: MadWizardOptions): Promise<Items> {
  const [{ VFile }, { stat, readdir }, { default: exec }, { default: readMarkdown }] = await Promise.all([
    import("vfile"),
    import("node:fs/promises"),
    import("./exec.js"),
    import("./read.js"),
  ])

  const md = /\.md$/

  const root = await stat(filepath)
    .then(() => filepath)
    .catch(() => join(options.store, filepath))
  const base = join(root, ".ls")

  const vfiles = await Promise.all(
    (
      await readdir(base)
    )
      .filter((entry) => md.test(entry))
      .map((_) => join(base, _))
      .map(async (path) => readMarkdown(path, options).then((value) => new VFile({ cwd: process.cwd(), path, value })))
  )

  const parts = await promiseEach(vfiles, async (vfile) => {
    const { title, description, output } = await exec(vfile, options, false)
    return { title, description, items: output.split(/\n/) }
  })

  const titlePartIdx = parts.findIndex((_) => !!_.title)
  return {
    title: titlePartIdx >= 0 ? parts[titlePartIdx].title : undefined,
    description: titlePartIdx >= 0 ? parts[titlePartIdx].description : undefined,
    items: parts.flatMap((_) => _.items).filter(Boolean),
  }
}
