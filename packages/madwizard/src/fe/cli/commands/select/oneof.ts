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

import { EOL } from "os"
import { ChalkInstance } from "chalk"

import select from "./index.js"
import type { Items } from "./ls.js"
import { UI, AnsiUI } from "../../../tree/index.js"

function suggestionHint(chalk: ChalkInstance) {
  // reset the underlining from enquirer
  return chalk.reset.yellow.dim("  ◄ prior choice")
}

async function oneof(choices: Items, chalk: ChalkInstance, suggestion?: string, ui: UI<string> = new AnsiUI()) {
  const enquirer = await import("enquirer").then((_) => _.default)

  const question = {
    stdout: process.stderr,
    title: choices.title || "Choose one of the following",
    description: choices.description,
    message: choices.title || "Choose one of the following",
    choices: choices.items.map((name) => {
      const isSuggested = suggestion === name
      const description = ""

      return {
        name,
        isSuggested,
        message:
          chalk.bold(name) +
          (isSuggested ? suggestionHint(chalk) : "") +
          (!description ? "" : chalk.reset(EOL) + ui.markdown(description) + chalk.reset(EOL)),
      }
    }),
  }

  // sigh... i can't figure out how to make a choice
  // default-selected; so... instead sort to float the selected
  // to the top
  question.choices.sort((a, b) => (suggestion === a.name ? -1 : suggestion === b.name ? 1 : 0))

  return new enquirer.Select(question).run()
}

export default select("oneof", "Interactively choose one item from a list of options", oneof)
