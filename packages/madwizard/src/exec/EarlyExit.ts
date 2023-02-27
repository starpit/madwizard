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

class EarlyExitError extends Error {
  public constructor(public readonly code: number) {
    super("Operation canceled")
  }
}

/**
 * An Error used to designate that a guidebook wants to stop now, but
 * with a normal exit code.
 */
export default function EarlyExit(code: number) {
  return new EarlyExitError(code)
}

/** @return whether the given `err` indicates an EarlyExit situation */
export function isEarlyExit(err: Error): err is EarlyExitError {
  return err.message === "Operation canceled"
}
