/**
 * Utilities to create computes pipelines
 * The pipelines should not recompute unless their inputs change
 * If a pipeline computes a new result but their input changed in the meantime, don't use the result
 * Each node of the pipeline returns a promise.
 */

import { logError } from "@/utils/log";

/**
 * Convert a tuple into a tuple of Nodes with the types compatible for ComputeNode.
 * Even if a node outputs a TNoOutput, it won't be given as parameter function, so accept it.
 *
 * Example:
 * convert `[number, string]`
 * into ```[
 *   ComputeNode<(...args: any) => Promise<number> | number | TNoOutput | Promise<TNoOutput>>,
 *   ComputeNode<(...args: any) => Promise<string> | string | TNoOutput | Promise<TNoOutput>>
 * ]```
 */
type WrapInComputeNode<T extends any[]> = {
  [P in keyof T]: ComputeNode<
    any,
    (...args: any) => Promise<T[P]> | T[P] | TNoOutput | Promise<TNoOutput>
  >;
};

/**
 * Use this symbol as output of compute nodes that don't have an output
 */
export const NoOutput: unique symbol = Symbol("No Output");

export type TNoOutput = typeof NoOutput;

/**
 * Helper function that makes life easier and code clearer when creating a new ComputeNode
 * If you use the constructor directly, you will sometimes have to explicitly give the generic types
 */
export function createComputeNode<T extends any[], U extends any>(
  fun: (...args: T) => U,
  parents: WrapInComputeNode<T>,
) {
  return new ComputeNode(fun, parents);
}

/**
 * A node of the pipeline
 * Just a wrapper around a function
 */
export class ComputeNode<
  Params extends any[],
  Fun extends (...args: Params) => any,
> {
  // The wrapped function
  private fun: Fun;
  private computing: boolean;
  // Set when the parameters changes but a computation is pending
  private shouldRecompute: boolean;
  // The cached output, don't use it directly but using this.output instead
  private _output: Awaited<ReturnType<Fun>> | TNoOutput;

  private computeCallback: () => void;
  private readonly parentNodes: WrapInComputeNode<Params>;
  private readonly outputUpdateCallbacks: (() => void)[] = [];

  /**
   * Create a new ComputeNode that wraps a function
   * @param fun The wrapped function
   * @param parentNodes This will subscribe to all parents output, and provide function parameters
   */
  constructor(fun: Fun, parentNodes: WrapInComputeNode<Params>) {
    this.fun = fun;
    this.computing = false;
    this.shouldRecompute = false;
    this._output = NoOutput;
    this.parentNodes = parentNodes;
    this.computeCallback = this.compute.bind(this);
    const nParents = this.parentNodes.length;
    for (let parentIndex = 0; parentIndex < nParents; ++parentIndex) {
      this.parentNodes[parentIndex].onOutputUpdate(this.computeCallback);
    }
  }

  /**
   * Register an other node to this node output updates
   * When the output of this node changes, it will call "subscribedOutputChanged()" on all subscribers
   * @param otherNode The node that registers for this node's output updates
   */
  private onOutputUpdate(callback: () => void) {
    this.outputUpdateCallbacks.push(callback);
  }

  /**
   * Check that none of the parent nodes have the ComputeNode.noOutput symbol as output
   */
  public getAreAllParametersReady() {
    const nParents = this.parentNodes.length;
    for (let parentIndex = 0; parentIndex < nParents; ++parentIndex) {
      const parentNode = this.parentNodes[parentIndex];
      if (!parentNode.hasOutput) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns a valid parameter list of the wrapped function or null if one of the node has no output
   */
  public getAllParameters(): Params | null {
    if (!this.getAreAllParametersReady()) {
      return null;
    }
    const nParents = this.parentNodes.length;
    const params: Params = new Array(nParents) as Params;
    for (let parentIndex = 0; parentIndex < nParents; ++parentIndex) {
      const paramNode = this.parentNodes[parentIndex];
      params[parentIndex] = paramNode.output;
    }
    return params;
  }

  /**
   * Reset the output and recompute
   * The returned promise resolves when the output has been set
   */
  private async compute() {
    if (this.computing) {
      this.shouldRecompute = true;
      return;
    }
    this.computing = true;

    // This will set all the children nodes output to "NoOutput"
    this.output = NoOutput;

    // Computation loop
    let computedOutput: typeof this.output;
    do {
      // Default to "NoOutput"
      computedOutput = NoOutput;
      const params = this.getAllParameters();
      // We took the parameters into account, don't need to recompute anymore
      this.shouldRecompute = false;
      // Do the computation
      if (params !== null) {
        try {
          computedOutput = await this.fun(...params);
        } catch (e) {
          logError("Computation of pipeline node failed");
          logError(e as string);
        }
      }
      // Recompute if the parameters changed
    } while (this.shouldRecompute);

    // This triggers callbacks
    this.output = computedOutput;

    this.computing = false;
  }

  public get output() {
    return this._output;
  }

  protected set output(newOutput) {
    this._output = newOutput;

    // Trigger all callbacks for the pipeline nodes that have subscribed to output changes
    const callbacks = this.outputUpdateCallbacks;
    for (let callbackIdx = 0; callbackIdx < callbacks.length; ++callbackIdx) {
      callbacks[callbackIdx]();
    }
  }

  public get hasOutput() {
    return this.output !== NoOutput;
  }

  public get isComputing() {
    return this.computing !== null;
  }
}

/**
 * Use this class to interface the ComputeNodes with the rest of the code
 * The generic type T can also include the special value NoOutput
 * Use NoOutput when you don't want the children nodes to compute
 */
export class ManualInputNode<T> extends ComputeNode<[], () => T | TNoOutput> {
  constructor() {
    super(() => NoOutput, []);
  }

  /**
   * Set the the output value of this node
   * If you want to be able to use NoOutput as a value, specify it explicitly in T
   */
  async setValue(value: T) {
    this.output = await value;
  }
}
