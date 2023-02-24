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

import { ChoiceState } from "../../../choices/index.js"
import { MadWizardOptions } from "../../MadWizardOptions.js"

import GuideOpts from "./guide/options.js"
import { loadAssertions, loadSuggestions } from "./util.js"

export default class ProfileManager {
  public suggestions: ChoiceState
  public choices: ChoiceState

  private lastPersist: ReturnType<typeof setTimeout>
  private lastPersistPromise: Promise<void>

  public constructor(private readonly options: MadWizardOptions) {}

  private get profile() {
    return this.options.profile
  }

  public async init(assert: GuideOpts["assert"] = undefined, opts: { isGuided?: boolean; noProfile?: boolean } = {}) {
    const { isGuided = true, noProfile = false } = opts

    const newChoiceState = await import("../../../choices/index.js").then((_) => _.newChoiceState)

    // restore choices from profile
    this.suggestions = await loadSuggestions(this.profile, this.options)

    // if we are doing a run, then use the suggestions as the final
    // choices; otherwise, treat them just as suggestions in the guide
    this.choices = loadAssertions(!isGuided ? this.suggestions : newChoiceState(this.profile), this.options, assert)

    if (!noProfile && !process.env.QUIET_CONSOLE) {
      this.choices.onChoice(() => {
        // persist choices after every choice is made, and remember the
        // async, so we can wait for it on exit
        if (this.lastPersist) {
          clearTimeout(this.lastPersist)
        }

        this.lastPersist = setTimeout(() => {
          this.lastPersist = undefined
          this.lastPersistPromise = this.persistChoices().then(() => {
            this.lastPersistPromise = undefined
          })
        }, 50)
      })
    }

    return this
  }

  public async cleanup() {
    if (this.lastPersistPromise) {
      // wait for the last choice persistence operation to
      // complete before we exit
      await this.lastPersistPromise
    } else if (this.lastPersist) {
      // then we have a scheduled async; cancel that and save
      // immediately
      clearTimeout(this.lastPersist)
      await this.persistChoices()
    }
  }

  // A handler to serialize choices. We will call this after every
  // choice. At exit, make sure to wait for the last persist to finish.
  public persistChoices() {
    return import("../../../profiles/persist.js").then((_) => _.default(this.options, this.choices, this.suggestions))
  }
}
