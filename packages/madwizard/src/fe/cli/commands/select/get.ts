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

import type { Arguments, CommandModule } from "yargs"

import type Opts from "../../options.js"
import { inputBuilder as builder, InputOpts } from "../input.js"
import type { MadWizardOptions } from "../../../MadWizardOptions.js"

export default function getModule(
  resolve: (value?: unknown) => void,
  reject: (err: Error) => void,
  providedOptions: MadWizardOptions
): CommandModule<Opts, InputOpts> {
  return {
    command: "get <input>",
    describe: "Determine the installed path of the given binary, installing if needed",
    builder,
    handler: async (argv: Arguments<InputOpts>) => {
      try {
        const [{ VFile }, { default: exec }, { default: readMarkdown }, { default: opts }] = await Promise.all([
          import("vfile"),
          import("./exec.js"),
          import("./read.js"),
          import("./options.js"),
        ])

        const path = argv.input
        const options = await opts(providedOptions, argv)
        const value = await readMarkdown(path, options)

        const { output } = await exec(new VFile({ cwd: process.cwd(), path, value }), options, false)

        console.log(output)
        resolve()
      } catch (err) {
        reject(err)
      }
    },
  }
}
