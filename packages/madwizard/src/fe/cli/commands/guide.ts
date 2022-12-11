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

import { Writable } from "stream"
import { Arguments, Argv, CommandModule } from "yargs"

import { UI } from "../../tree/index.js"
import { MadWizardOptions } from "../../MadWizardOptions.js"

import { group } from "../strings.js"
import { InputOpts, inputBuilder } from "./input.js"
import Opts, { assembleOptions } from "../options.js"
import { getBlocksModel, loadAssertions, loadSuggestions, makeMemos } from "./util.js"

export type CommonOpts = {
  /** Emit extra low-level content, such as command lines and env var updates */
  verbose?: boolean

  /** Try to emit as little superfluous output as possible */
  quiet?: boolean
}

type GuideOpts = InputOpts &
  CommonOpts & {
    /** Accept all prior choices */
    yes?: boolean

    /** Run in interactive mode, and overridden by value of `yes` (default: true) */
    interactive?: boolean

    /** Emit computer-readable output for Q&A interactions */
    raw?: boolean

    /** When emitting raw output, prefix every line with this string */
    "raw-prefix"?: string
  }

const mainGroup = group("Guide Options:")
const expertGroup = group("Guide Options (Advanced):")
const developersGroup = group("Guide Options (Developers):")

export const commonOptions = {
  verbose: {
    alias: "V",
    type: "boolean" as const,
    group: mainGroup,
    describe: "Emit extra low-level content, such as command lines and env var updates",
  },
  quiet: {
    alias: "q",
    type: "boolean" as const,
    group: expertGroup,
    describe: "Try to emit as little superfluous output as possible",
  },
}

const guideOptions = {
  yes: {
    alias: "y",
    type: "boolean" as const,
    group: mainGroup,
    describe: "Auto-accept all prior answers from your profile",
  },
  interactive: {
    alias: "i",
    type: "boolean" as const,
    default: true,
    group: expertGroup,
    describe: "Always ask questions",
  },
  raw: {
    alias: "r",
    type: "boolean" as const,
    group: developersGroup,
    describe: "Emit computer-readable output for Q&A interactions",
  },
  "raw-prefix": {
    type: "string" as const,
    group: developersGroup,
    describe: "When emitting raw output, prefix every line with this string",
  },
}

function assembleOptionsForGuide(providedOptions: MadWizardOptions, commandLineOptions: Arguments<GuideOpts>) {
  return Object.assign({}, assembleOptions(providedOptions, commandLineOptions), {
    veto: commandLineOptions.veto === undefined ? undefined : new RegExp(commandLineOptions.veto),
  })
}

function builder(yargs: Argv<Opts>): Argv<GuideOpts> {
  return inputBuilder(yargs).options(guideOptions).options(commonOptions)
}

async function guideHandler<Writer extends Writable["write"]>(
  task: "run" | "guide",
  providedOptions: MadWizardOptions,
  argv: Arguments<GuideOpts>,
  write?: Writer,
  ui?: UI<string>
) {
  const { input } = argv
  const noProfile = argv.profile === false

  const options = assembleOptionsForGuide(providedOptions, argv)
  if (options.quiet) {
    process.env.QUIET_CONSOLE = "true"
  }

  const newChoiceState = await import("../../../choices/index.js").then((_) => _.newChoiceState)

  // restore choices from profile
  const profile = options.profile
  const suggestions = await loadSuggestions(argv, options)

  // if we are doing a run, then use the suggestions as the final
  // choices; otherwise, treat them just as suggestions in the guide
  const choices = loadAssertions(task === "run" ? suggestions : newChoiceState(profile), providedOptions, argv)

  // A handler to serialize choices. We will call this after every
  // choice. At exit, make sure to wait for the last persist to finish.
  let lastPersist: ReturnType<typeof setTimeout>
  let lastPersistPromise: Promise<void>
  const persistChoices = () =>
    import("../../../profiles/persist.js").then((_) => _.default(options, choices, suggestions))
  if (!noProfile && !process.env.QUIET_CONSOLE) {
    choices.onChoice(() => {
      // persist choices after every choice is made, and remember the
      // async, so we can wait for it on exit
      if (lastPersist) {
        clearTimeout(lastPersist)
      }

      lastPersist = setTimeout(() => {
        lastPersist = undefined
        lastPersistPromise = persistChoices().then(() => {
          lastPersistPromise = undefined
        })
      }, 50)
    })
  }

  // bump the `lastUsedTime` attribute
  if (!process.env.QUIET_CONSOLE && !noProfile && options.bump !== false) {
    choices.profile.lastUsedTime = Date.now()
    persistChoices()
  }

  // this is the block model we parse from the source
  const blocks = await getBlocksModel(input, choices, options)

  // a name we might want to associate with the run, in the logs
  const name = options.name ? ` (${options.name})` : ""

  const exitMessage = `⚠️ Exiting${name} now, please wait for us to gracefully clean things up`
  const [memoizer, Guide] = await Promise.all([
    makeMemos(suggestions, argv),
    import("../../guide/index.js").then((_) => _.Guide),
  ])

  /** Kill any spawned subprocesses */
  const cleanExit = memoizer.cleanup.bind(memoizer)
  const cleanExitFromSIGINT = () => {
    console.error("Received interrupt")
    console.error(exitMessage)
    cleanExit("SIGINT")
  }
  const cleanExitFromSIGTERM = () => {
    console.error("Received termination request")
    console.error(exitMessage)
    cleanExit("SIGTERM")
  }
  process.on("SIGINT", cleanExitFromSIGINT) // catch ctrl-c
  process.on("SIGTERM", cleanExitFromSIGTERM) // catch kill

  if (providedOptions.onBeforeRun) {
    providedOptions.onBeforeRun({ cleanExit })
  }

  try {
    await new Guide(task, blocks, choices, options, memoizer, ui, write).run()
  } finally {
    if (options.verbose && task !== "run") {
      console.error(exitMessage)
    }
    if (!noProfile) {
      if (lastPersistPromise) {
        // wait for the last choice persistence operation to
        // complete before we exit
        await lastPersistPromise
      } else if (lastPersist) {
        // then we have a scheduled async; cancel that and save
        // immediately
        clearTimeout(lastPersist)
        await persistChoices()
      }
    }

    if (options.clean !== false) {
      cleanExit()
    }

    // in case we were launched as part of some parent, not a
    // standalone process, make sure to deregister here:
    process.off("SIGINT", cleanExitFromSIGINT) // catch ctrl-c
    process.off("SIGTERM", cleanExitFromSIGTERM) // catch kill
  }

  return {
    cleanExit,
    env: memoizer.env,
  }
}

export type GuideRet = {
  cleanExit: () => void
  env: typeof process.env
}

export default function guideModule<Writer extends Writable["write"]>(
  task: "run" | "guide",
  resolve: (ret: GuideRet) => void,
  reject: (err: Error) => void,
  providedOptions: MadWizardOptions,
  write?: Writer,
  ui?: UI<string>
): CommandModule<Opts, GuideOpts> {
  return {
    command: `${task} <input>`,
    describe: "Parse and run a given markdown using an interactive wizard",
    builder,
    handler: async (argv: Arguments<GuideOpts>) =>
      await guideHandler(task, providedOptions, argv, write, ui).then(resolve, reject),
  }
}
