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

import type { Arguments } from "yargs"

import type { InputOpts } from "../input.js"
import type { MadWizardOptions } from "../../../MadWizardOptions.js"

export default async function opts(providedOptions: MadWizardOptions, argv: Arguments<InputOpts>) {
  const [{ resolve: pathResolve }, { assembleOptions }] = await Promise.all([
    import("path"),
    import("../../options.js"),
  ])

  const opts = assembleOptions(providedOptions, argv)
  if (argv.input && !opts.store) {
    const store = argv.input.slice(0, argv.input.indexOf("/fs/"))
    opts.store = pathResolve(store)
  }
  return opts
}
