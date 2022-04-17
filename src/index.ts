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

import { read } from "to-vfile"
import expandHomeDir from "expand-home-dir"

import ChoiceState from "./choices/impl"

import * as ParserApi from "./parser"
export { ParserApi }

import * as DagApi from "./dag"
export { DagApi }

import * as WizardApi from "./wizard"
export { WizardApi }

export default async function main(input: string, choices = new ChoiceState()) {
  const blocks = await ParserApi.blockify(await read(expandHomeDir(input)))
  const dag = DagApi.daggify(blocks, choices)
  const wizard = WizardApi.wizardify(dag, choices)

  return { blocks, dag, wizard }
}
