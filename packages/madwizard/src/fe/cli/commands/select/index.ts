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

import { Chalk, ChalkInstance } from "chalk"
import type { Arguments, CommandModule } from "yargs"

import type { Items } from "./ls.js"
import type Opts from "../../options.js"
import { UI, AnsiUI } from "../../../tree/index.js"
import type { MadWizardOptions } from "../../../MadWizardOptions.js"
import { inputBuilder as builder, InputOpts } from "../input.js"

import opts from "./options.js"

function choiceKey(input: string, options: MadWizardOptions) {
  if (options.store) {
    return input.replace(new RegExp("^" + options.store), "")
  } else {
    return input
  }
}

export default function selectModule(
  cmd: string,
  describe: CommandModule["describe"],
  select: (choices: Items, chalk: ChalkInstance, suggestion?: string, ui?: UI<string>) => Promise<string | string[]>
) {
  return function (
    resolve: (value?: unknown) => void,
    reject: (err: Error) => void,
    providedOptions: MadWizardOptions
  ): CommandModule<Opts, InputOpts> {
    return {
      command: `${cmd} <input>`,
      describe,
      builder,
      handler: async (argv: Arguments<InputOpts>) => {
        const [options, ProfileManager] = await Promise.all([
          opts(providedOptions, argv),
          import("../ProfileManager.js").then((_) => _.default),
        ])

        const ui = new AnsiUI()
        const chalk = new Chalk({ level: 2 })
        const profileManager = await new ProfileManager(options).init()

        try {
          const choices = await import("./ls.js").then((_) => _.default(argv.input, options))

          const choice = choiceKey(argv.input, options)
          const suggestion = profileManager.suggestions.getKey(choice)

          const selection = await select(choices, chalk, suggestion, ui)
          profileManager.choices.setKey(choice, typeof selection === "string" ? selection : JSON.stringify(selection))
          console.log(selection)

          resolve()
        } catch (err) {
          // sigh, this is enquirer's bizarre way of indicating the prompt was cancelled
          if (!err.message) {
            process.exit(130)
          } else {
            console.error(err)
            reject(err)
          }
        } finally {
          await profileManager.cleanup()
        }
      },
    }
  }
}
