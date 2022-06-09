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

import { Choice } from "../graph/index.js"
import ChoiceEventManager from "./events.js"
import { ChoiceState, ChoicesMap, Key } from "./index.js"

export default class ChoiceStateImpl extends ChoiceEventManager implements ChoiceState {
  public constructor(
    /** Choices made, e.g. "i want to install using homebrew" */
    private readonly _choices: ChoicesMap = {},

    /** Choices rejected, e.g. "i really don't want to install using curl" */
    private readonly rejectedChoices: Record<keyof ChoicesMap, boolean> = {}
  ) {
    super()
  }

  public clone() {
    return new ChoiceStateImpl(this._choices, this.rejectedChoices)
  }

  public keys() {
    return Object.keys(this._choices)
  }

  public entries() {
    return Object.entries(this._choices)
  }

  private key(choice: Choice) {
    return choice.groupContext
  }

  public contains(choice: Choice) {
    return this.key(choice) in this._choices
  }

  /** @return the current memoized selection for the given `Choice` */
  public get(choice: Choice) {
    return this._choices[this.key(choice)]
  }

  /** Remove the memoized selection for the given `Choice` */
  public remove(choice: Choice) {
    return this.removeKey(this.key(choice))
  }

  /** Take care with this. If you have a `Choice`, then prefer to use `remove(choice)` */
  public removeKey(key: Key): boolean {
    if (key in this._choices) {
      delete this._choices[key]
      this.rejectedChoices[key] = true
      this.notifyOfChoice(this)
      return true
    } else {
      return false
    }
  }

  /** Memoize a selection for the given `Choice` */
  public set(choice: Choice, value: ChoicesMap[Key], overrideRejections = true) {
    return this.setKey(this.key(choice), value, overrideRejections)
  }

  /** Take care with this. If you have a `Choice`, then prefer to use `set(choice, value)` */
  public setKey(key: Key, value: ChoicesMap[Key], overrideRejections?: boolean): boolean {
    if (this._choices[key] === value) {
      return false
    }

    if (overrideRejections || !(key in this.rejectedChoices)) {
      delete this.rejectedChoices[key]
      this._choices[key] = value
      this.notifyOfChoice(this)
      return true
    } else {
      return false
    }
  }

  /** State representing form completion */
  public formComplete(choice: Choice, value: Record<string, string>) {
    return this.set(choice, JSON.stringify(value))
  }

  /** Extract form responses */
  public form(choice: Choice): Record<string, string> {
    const raw = this.get(choice)
    if (raw) {
      try {
        return JSON.parse(raw)
      } catch (err) {
        // fall-through
      }
    }
  }
}
