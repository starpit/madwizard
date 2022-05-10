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

import chalk from "chalk"
import Debug from "debug"

import { hasProvenance } from "./provenance"
import { oraPromise } from "../util/ora-delayed-promise"

import {
  CompileOptions,
  Graph,
  Ordered,
  Unordered,
  doValidate,
  extractTitle,
  hasKey,
  isSequence,
  isParallel,
  isChoice,
  isTitledSteps,
  isSubTask,
  isValidatable,
} from "."

/**
 * Execute the `validate` property of the steps in the given `wizard`,
 * and stash the result in the `status` field of each step.
 */
export default async function collapseValidated<
  T extends Unordered | Ordered = Unordered,
  G extends Graph<T> = Graph<T>
>(graph: G, options?: CompileOptions, nearestEnclosingTitle?: string): Promise<G> {
  if (options) {
    if (
      options.optimize &&
      (options.optimize === false || (options.optimize !== true && options.optimize.validate === false))
    ) {
      // then this optimization has been disabled
      return graph
    } else if (options.veto && hasProvenance(graph) && graph.provenance.find((_) => options.veto.has(_))) {
      Debug("madwizard/graph/optimize/collapse-validated")("veto", extractTitle(graph))
      // then this optimization has been vetoed
      return graph
    }
  }

  if (isValidatable(graph)) {
    const key: string = hasKey(graph) ? graph.key : graph.validate.toString()
    if (graph.validate === true) {
      return undefined
    } else if (typeof graph.validate === "string") {
      if (options.statusMemo && options.statusMemo[key] && options.statusMemo[key] === "success") {
        // this Validatable has been previously validated in this
        // session (as indicated by its presence in the given
        // `statusMemo`
        return undefined
      } else {
        // otherwise, attempt to validate this Validatable
        const status = await oraPromise(
          doValidate(graph.validate, options),
          chalk.dim(`Validating ${chalk.blue(nearestEnclosingTitle || key)}`)
        )
        if (options.statusMemo) {
          // great, now memoize the result
          options.statusMemo[key] = status
        }
        if (status === "success") {
          return undefined
        }
      }
    }
  }

  const recurse = <T extends Unordered | Ordered, G extends Graph<T>>(graph: G) =>
    collapseValidated(graph, options, extractTitle(graph) || nearestEnclosingTitle)

  const recurse2 = <T extends Unordered | Ordered, G extends Graph<T>>({ graph }: { graph: G }) => recurse(graph)

  if (isSequence<T>(graph)) {
    graph.sequence = await Promise.all(graph.sequence.map(recurse)).then((_) => _.filter(Boolean))
    if (graph.sequence.length > 0) {
      return graph
    }
  } else if (isParallel<T>(graph)) {
    graph.parallel = await Promise.all(graph.parallel.map(recurse)).then((_) => _.filter(Boolean))
    if (graph.parallel.length > 0) {
      return graph
    }
  } else if (isChoice<T>(graph)) {
    const parts = await Promise.all(graph.choices.map(recurse2)).then((_) => _.filter(Boolean))
    if (graph.choices.length > 0) {
      graph.choices.forEach((_, idx) => (_.graph = parts[idx]))
      return graph
    }
  } else if (isTitledSteps<T>(graph)) {
    const steps = await Promise.all(graph.steps.map(recurse2)).then((_) => _.filter(Boolean))
    if (steps.length > 0) {
      graph.steps.forEach((_, idx) => (_.graph = steps[idx]))
      return graph
    }
  } else if (isSubTask<T>(graph)) {
    graph.graph = await recurse(graph.graph)
    if (graph.graph) {
      return graph
    }
  } else {
    return graph
  }
}