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

import select from "./index.js"
import { Items } from "./ls.js"

async function severalof(choices: Items) {
  const enquirer = await import("enquirer").then((_) => _.default)

  const question = {
    title: choices.title || "Choose one or more of the following",
    description: choices.description,
    message: choices.title || "Choose one or more of the following",
    choices: choices.items.map((name) => ({ name })),
    stdout: process.stderr,
  }
  return new enquirer.MultiSelect(question).run()
}

export default select("severalof", "Interactively choose one or more items from a list of options", severalof)
