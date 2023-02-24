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

import type { VFile } from "vfile"
import type { MadWizardOptions } from "../../../MadWizardOptions.js"

export default async function exec(vfile: VFile, options: MadWizardOptions, clear = true) {
  const { default: guide } = await import("../guide/handler.js")

  let output = ""
  const write = (frag: string) => {
    output = output + frag
    return true
  }

  const { title, description } = await guide(
    "guide",
    Object.assign({}, options, {
      vfile,
      clear,
      verbose: false,
      stdio: { stdin: process.stdin, stdout: process.stderr },
    }),
    { input: "-", _: [], $0: "" },
    write
  )

  return { title, description, output }
}
