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
  private fun: Fun;
  private computing: boolean;
  private _output: Awaited<ReturnType<Fun>> | TNoOutput;
  protected readonly parentNodes: WrapInComputeNode<Params>;
  private readonly outputUpdateSubscribers: ComputeNode<any, any>[] = [];

  /**
   * Create a new ComputeNode that wraps a function
   * @param fun The wrapped function
   * @param parentNodes This will subscribe to all parents output, and provide function parameters
   */
  constructor(fun: Fun, parentNodes: WrapInComputeNode<Params>) {
    this.fun = fun;
    this.computing = false;
    this._output = NoOutput;
    this.parentNodes = parentNodes;
    const nParams = this.parentNodes.length;
    for (let paramIndex = 0; paramIndex < nParams; ++paramIndex) {
      const paramNode = this.parentNodes[paramIndex];
      paramNode.subscribeToOutputUpdate(this);
    }
  }

  /**
   * Register an other node to this node output updates
   * When the output of this node changes, it will call "subscribedOutputChanged()" on all subscribers
   * @param otherNode The node that registers for this node's output updates
   */
  public subscribeToOutputUpdate(otherNode: ComputeNode<any, any>) {
    this.outputUpdateSubscribers.push(otherNode);
  }

  /**
   * Check that none of the parent nodes have the ComputeNode.noOutput symbol as output
   */
  public getAreAllParametersReady() {
    const nParams = this.parentNodes.length;
    for (let paramIndex = 0; paramIndex < nParams; ++paramIndex) {
      const paramNode = this.parentNodes[paramIndex];
      if (!paramNode.hasOutput) {
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
    const nParams = this.parentNodes.length;
    const params: Params = new Array(nParams) as Params;
    for (let paramIndex = 0; paramIndex < nParams; ++paramIndex) {
      const paramNode = this.parentNodes[paramIndex];
      params[paramIndex] = paramNode.output;
    }
    return params;
  }

  /**
   * Reset the output and recompute it if possible
   */
  public async compute() {
    this.output = NoOutput;
    const params = this.getAllParameters();
    if (params === null) {
      return;
    }
    try {
      this.computing = true;
      this.output = await this.fun(...params);
    } catch (e) {
      logError("Computation of pipeline node failed");
      logError(e as string);
    } finally {
      this.computing = false;
    }
  }

  /**
   * When the parents output change, recompute
   */
  protected subscribedOutputChanged() {
    this.compute();
  }

  public get output() {
    return this._output;
  }

  private set output(newOutput) {
    if (newOutput === this._output) {
      return;
    }
    this._output = newOutput;

    // Trigger all callbacks for the pipeline nodes that have subscribed to output changes
    const subscribers = this.outputUpdateSubscribers;
    for (
      let subscriberIdx = 0;
      subscriberIdx < subscribers.length;
      ++subscriberIdx
    ) {
      const subscriber = subscribers[subscriberIdx];
      subscriber.subscribedOutputChanged();
    }
  }

  public get hasOutput() {
    return this.output !== NoOutput;
  }

  public get isComputing() {
    return this.computing;
  }
}

/**
 * Use this class to interface the ComputeNodes with the rest of the code
 */
export class ManualInputNode<T> extends ComputeNode<[], () => T | TNoOutput> {
  manuallySetOutput: T | TNoOutput;

  constructor() {
    super(() => this.manuallySetOutput, []);
    this.manuallySetOutput = NoOutput;
  }

  setOutput(output: T) {
    this.manuallySetOutput = output;
    this.dirty();
  }

  dirty() {
    this.compute();
  }
}

/**
 * Use this class to interface the ComputeNodes with the rest of the code
 */
export class ManualOutputNode<T> extends ComputeNode<[T], (x: T) => any> {
  constructor(
    parentNode: WrapInComputeNode<[T]>[0],
    private callback: (x: Awaited<T> | TNoOutput) => any,
  ) {
    super(() => {}, [parentNode]);
  }

  protected subscribedOutputChanged() {
    this.callback(this.parentNodes[0].output);
  }
}
