/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

export class ExternalObject<T> {
  readonly '': {
    readonly '': unique symbol
    [K: symbol]: T
  }
}
/**
 * Expands the given entries into a list of existing directories and files.
 * This is used for copying outputs to and from the cache
 */
export function expandOutputs(directory: string, entries: Array<string>): Array<string>
/**
 * Expands the given outputs into a list of existing files.
 * This is used when hashing outputs
 */
export function getFilesForOutputs(directory: string, entries: Array<string>): Array<string>
export function remove(src: string): void
export function copy(src: string, dest: string): void
export function hashArray(input: Array<string>): string
export function hashFile(file: string): string | null
export function findImports(projectFileMap: Record<string, Array<string>>): Array<ImportResult>
/**
 * Transfer the project graph from the JS world to the Rust world, so that we can pass the project graph via memory quicker
 * This wont be needed once the project graph is created in Rust
 */
export function transferProjectGraph(projectGraph: ProjectGraph): ExternalObject<ProjectGraph>
export interface ExternalNode {
  packageName?: string
  version: string
  hash?: string
}
export interface Target {
  executor?: string
  inputs?: Array<JsInputs>
  outputs?: Array<string>
  options?: string
  configurations?: string
}
export interface Project {
  root: string
  namedInputs?: Record<string, Array<JsInputs>>
  tags?: Array<string>
  targets: Record<string, Target>
}
export interface ProjectGraph {
  nodes: Record<string, Project>
  dependencies: Record<string, Array<string>>
  externalNodes: Record<string, ExternalNode>
}
export interface HashDetails {
  value: string
  details: Record<string, string>
}
export interface HasherOptions {
  selectivelyHashTsConfig: boolean
}
export interface Task {
  id: string
  target: TaskTarget
  outputs: Array<string>
  projectRoot?: string
}
export interface TaskTarget {
  project: string
  target: string
  configuration?: string
}
export interface TaskGraph {
  roots: Array<string>
  tasks: Record<string, Task>
  dependencies: Record<string, Array<string>>
}
export interface FileData {
  file: string
  hash: string
  size: number
}
export interface InputsInput {
  input: string
  dependencies?: boolean
  projects?: string | Array<string>
}
export interface FileSetInput {
  fileset: string
}
export interface RuntimeInput {
  runtime: string
}
export interface EnvironmentInput {
  env: string
}
export interface ExternalDependenciesInput {
  externalDependencies: Array<string>
}
export interface DepsOutputsInput {
  dependentTasksOutputFiles: string
  transitive?: boolean
}
/** Stripped version of the NxJson interface for use in rust */
export interface NxJson {
  namedInputs?: Record<string, Array<JsInputs>>
}
export const enum EventType {
  delete = 'delete',
  update = 'update',
  create = 'create'
}
export interface WatchEvent {
  path: string
  type: EventType
}
/** Public NAPI error codes that are for Node */
export const enum WorkspaceErrors {
  ParseError = 'ParseError',
  Generic = 'Generic'
}
export interface NxWorkspaceFiles {
  projectFileMap: ProjectFiles
  globalFiles: Array<FileData>
  externalReferences?: NxWorkspaceFilesExternals
}
export interface NxWorkspaceFilesExternals {
  projectFiles: ExternalObject<ProjectFiles>
  globalFiles: ExternalObject<Array<FileData>>
  allWorkspaceFiles: ExternalObject<Array<FileData>>
}
export interface UpdatedWorkspaceFiles {
  fileMap: FileMap
  externalReferences: NxWorkspaceFilesExternals
}
export interface FileMap {
  projectFileMap: ProjectFiles
  nonProjectFiles: Array<FileData>
}
export function testOnlyTransferFileMap(projectFiles: Record<string, Array<FileData>>, nonProjectFiles: Array<FileData>): NxWorkspaceFilesExternals
export class ImportResult {
  file: string
  sourceProject: string
  dynamicImportExpressions: Array<string>
  staticImportExpressions: Array<string>
}
export class ChildProcess {
  kill(): void
  onExit(callback: (message: string) => void): void
  onOutput(callback: (message: string) => void): void
}
export class RustPseudoTerminal {
  constructor()
  runCommand(command: string, commandDir?: string | undefined | null, jsEnv?: Record<string, string> | undefined | null, execArgv?: Array<string> | undefined | null, quiet?: boolean | undefined | null, tty?: boolean | undefined | null): ChildProcess
  /**
   * This allows us to run a pseudoterminal with a fake node ipc channel
   * this makes it possible to be backwards compatible with the old implementation
   */
  fork(id: string, forkScript: string, pseudoIpcPath: string, commandDir: string | undefined | null, jsEnv: Record<string, string> | undefined | null, execArgv: Array<string> | undefined | null, quiet: boolean): ChildProcess
}
export class HashPlanner {
  constructor(nxJson: NxJson, projectGraph: ExternalObject<ProjectGraph>)
  getPlans(taskIds: Array<string>, taskGraph: TaskGraph): Record<string, string[]>
  getPlansReference(taskIds: Array<string>, taskGraph: TaskGraph): JsExternal
}
export class TaskHasher {
  constructor(workspaceRoot: string, projectGraph: ExternalObject<ProjectGraph>, projectFileMap: ExternalObject<ProjectFiles>, allWorkspaceFiles: ExternalObject<Array<FileData>>, tsConfig: Buffer, tsConfigPaths: Record<string, Array<string>>, options?: HasherOptions | undefined | null)
  hashPlans(hashPlans: ExternalObject<Record<string, Array<HashInstruction>>>, jsEnv: Record<string, string>): NapiDashMap
}
export class Watcher {
  origin: string
  /**
   * Creates a new Watcher instance.
   * Will always ignore the following directories:
   * * .git/
   * * node_modules/
   * * .nx/
   */
  constructor(origin: string, additionalGlobs?: Array<string> | undefined | null, useIgnore?: boolean | undefined | null)
  watch(callback: (err: string | null, events: WatchEvent[]) => void): void
  stop(): Promise<void>
}
export class WorkspaceContext {
  workspaceRoot: string
  constructor(workspaceRoot: string, cacheDir: string)
  getWorkspaceFiles(projectRootMap: Record<string, string>): NxWorkspaceFiles
  glob(globs: Array<string>, exclude?: Array<string> | undefined | null): Array<string>
  hashFilesMatchingGlob(globs: Array<string>, exclude?: Array<string> | undefined | null): string
  incrementalUpdate(updatedFiles: Array<string>, deletedFiles: Array<string>): Array<FileData>
  updateProjectFiles(projectRootMappings: ProjectRootMappings, projectFiles: ExternalObject<ProjectFiles>, globalFiles: ExternalObject<Array<FileData>>, updatedFiles: Array<FileData>, deletedFiles: Array<string>): UpdatedWorkspaceFiles
  allFileData(): Array<FileData>
  getFilesInDirectory(directory: string): Array<string>
}
