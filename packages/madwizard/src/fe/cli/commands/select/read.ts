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

import type { MadWizardOptions } from "../../../MadWizardOptions.js"

function rewriteToMapToMadWizardIntrinsics(source: string): string {
  return source.replace(/\$\((cat|which) \/(.+)\)/g, "$(mw_$1 /$2)")
}

export default async function readMarkdown(filepath: string, madwizardOptions: MadWizardOptions) {
  const [{ madwizardRead }, { fetcherFor }, inlineSnippets] = await Promise.all([
    import("../../madwizardRead.js"),
    import("../../../../parser/markdown/fetch.js"),
    import("../../../../parser/markdown/snippets/index.js").then((_) => _.default),
  ])
  const fetcher = fetcherFor(madwizardRead, madwizardOptions.store, true)
  const sourcePriorToInlining = await fetcher(filepath)
    .catch(() => fetcher(filepath.replace(/^\//, "")))
    .then(rewriteToMapToMadWizardIntrinsics)

  return inlineSnippets({ fetcher, madwizardOptions })(sourcePriorToInlining, filepath)
}
